import { act, render, screen, waitFor } from 'test/test-utils';

import { setPluginComponentHook } from '@grafana/runtime';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { NotebookScene } from '../scene/NotebookScene';
import { NotebookCellItem } from '../scene/layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from '../scene/layout-notebook/NotebookLayoutManager';

import { getNotebookPageStateManager } from './NotebookPageStateManager';
import { NotebookRenderPage } from './NotebookRenderPage';

setPluginComponentHook(() => ({ component: null, isLoading: false }));

// The page reads its uid from the route params, which need a matched Route to be populated — the
// test renders the component directly, so they are supplied here instead.
jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useParams: () => ({ uid: 'nb1' }),
}));

/**
 * The state manager is stubbed rather than driven through `loadNotebook`, which always goes to the
 * api before it consults its cache. What belongs to this page is narrow — ask for the load, render
 * the scene or nothing, stop autosave — and loading itself is covered by the manager's own tests.
 */
jest.mock('./NotebookPageStateManager', () => ({
  getNotebookPageStateManager: jest.fn(),
}));

const mockGetStateManager = jest.mocked(getNotebookPageStateManager);

function buildScene() {
  return new NotebookScene({
    title: 'Q2 latency regression',
    uid: 'nb1',
    body: new NotebookLayoutManager({
      cells: [
        new NotebookCellItem({
          elementName: 'md1',
          source: 'user',
          content: { kind: 'Markdown', spec: { text: 'Findings' } },
        }),
      ],
    }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });
}

function stubStateManager(scene?: NotebookScene, loadError?: { message: string; status?: number }) {
  const loadNotebook = jest.fn();
  const clearState = jest.fn();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the three members the page touches
  mockGetStateManager.mockReturnValue({
    useState: () => ({ scene, isLoading: false, loadError }),
    loadNotebook,
    clearState,
  } as unknown as ReturnType<typeof getNotebookPageStateManager>);

  return { loadNotebook, clearState };
}

/** Stands in for the chromedp binding grafana-image-renderer injects. */
function captureRenderMessages() {
  const channel = jest.fn();
  window.__grafanaImageRendererMessageChannel = channel;

  return () => channel.mock.calls.map(([raw]) => JSON.parse(String(raw)));
}

const NOTEBOOKS_FLAG = 'dashboard.notebooks';

describe('NotebookRenderPage', () => {
  afterEach(async () => {
    // setTestFlags publishes OpenFeature events, which can land while a component is still mounted.
    await act(async () => {
      setTestFlags({});
    });
    delete window.__grafanaImageRendererMessageChannel;
    jest.clearAllMocks();
  });

  it('renders the not-found page when the feature flag is off', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: false });
    const { loadNotebook } = stubStateManager();

    render(<NotebookRenderPage />);

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    // The flag gates the load too, not only what is drawn.
    expect(loadNotebook).not.toHaveBeenCalled();
  });

  it('asks for the notebook named in the route', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    const { loadNotebook } = stubStateManager();

    render(<NotebookRenderPage />);

    await waitFor(() => {
      expect(loadNotebook).toHaveBeenCalledWith('nb1');
    });
  });

  // Deliberately no spinner: the renderer captures whatever is on the page once it settles, so a
  // loading state would simply become the PDF. Better to render nothing and let the render time out.
  it('renders nothing at all while there is no scene, rather than a loading state', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    stubStateManager();

    const { container } = render(<NotebookRenderPage />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('renders the notebook document once the scene resolves', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    stubStateManager(buildScene());

    render(<NotebookRenderPage />);

    expect(await screen.findByText('Findings')).toBeInTheDocument();
  });

  // The whole point of the route: everything the ordinary page wraps a notebook in is simply not
  // rendered here, rather than rendered and then hidden.
  it('leaves out the controls row, so the capture is only the document', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    stubStateManager(buildScene());

    render(<NotebookRenderPage />);

    await screen.findByText('Findings');
    expect(screen.queryByRole('button', { name: /Time range selected/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refresh time interval/i })).not.toBeInTheDocument();
  });

  // A tab that exists to photograph the notebook must not be able to write to it. Harmless in
  // practice, since a capture makes no edits — but not a property worth leaving to chance.
  it('abandons autosave, so the render can never write to the notebook it is rendering', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    const scene = buildScene();
    const abandon = jest.spyOn(scene.autosave, 'abandon');
    stubStateManager(scene);

    render(<NotebookRenderPage />);

    await screen.findByText('Findings');
    expect(abandon).toHaveBeenCalled();
  });
});

describe('NotebookRenderPage readiness', () => {
  afterEach(async () => {
    await act(async () => {
      setTestFlags({});
    });
    delete window.__grafanaImageRendererMessageChannel;
    jest.clearAllMocks();
  });

  // A failure is an answer, and the renderer is left waiting without one. Success needs no message:
  // the renderer polls for the page to settle, which is how a good capture is detected today.
  it('reports failure to the renderer when the notebook could not be loaded', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    const messages = captureRenderMessages();
    stubStateManager(undefined, { message: 'Notebook not found', status: 404 });

    render(<NotebookRenderPage />);

    await waitFor(() => {
      expect(messages()).toEqual([{ type: 'REPORT_RENDER_COMPLETE', data: { success: false } }]);
    });
  });

  it('says nothing to the renderer on the way to a successful capture', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    const messages = captureRenderMessages();
    stubStateManager(buildScene());

    render(<NotebookRenderPage />);

    await screen.findByText('Findings');
    expect(messages()).toEqual([]);
  });

  // Rendered rather than swallowed, so a polling capture produces something diagnosable instead of
  // a blank sheet.
  it('shows the failure on the page', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    captureRenderMessages();
    stubStateManager(undefined, { message: 'Notebook not found', status: 404 });

    render(<NotebookRenderPage />);

    expect(await screen.findByText('Notebook not found')).toBeInTheDocument();
  });
});
