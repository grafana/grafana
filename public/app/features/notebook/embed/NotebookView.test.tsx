import { act, render, screen } from 'test/test-utils';

import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';

import { NotebookPageStateManager } from '../pages/NotebookPageStateManager';
import { NotebookScene } from '../scene/NotebookScene';
import { NotebookLayoutManager } from '../scene/layout-notebook/NotebookLayoutManager';

import { NotebookView } from './NotebookView';

const NOTEBOOKS_FLAG = 'dashboard.notebooks';

/**
 * The manager this component builds for itself, captured as it is asked to load. Stubbing the load
 * is what keeps these tests off the network; capturing `this` is the only way to reach an instance
 * the component owns, which is the whole point of it not using the shared one.
 */
function captureStateManager() {
  const instances: NotebookPageStateManager[] = [];
  const loadedUids: string[] = [];

  jest.spyOn(NotebookPageStateManager.prototype, 'loadNotebook').mockImplementation(async function (
    this: NotebookPageStateManager,
    uid: string
  ) {
    instances.push(this);
    loadedUids.push(uid);
  });

  return { instances, loadedUids };
}

function aNotebookScene(title = 'Checkout latency investigation') {
  return new NotebookScene({
    title,
    uid: 'nb-1',
    body: new NotebookLayoutManager({ cells: [] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });
}

describe('NotebookView', () => {
  afterEach(async () => {
    await act(async () => {
      setTestFlags({});
    });
    jest.restoreAllMocks();
  });

  // The host is a plugin, which cannot see the flag: rendering nothing is what stops a notebook
  // appearing on an instance where the feature is off.
  it('renders nothing when the feature flag is off', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: false });
    const { loadedUids } = captureStateManager();

    const { container } = render(<NotebookView uid="nb-1" />);

    expect(container).toBeEmptyDOMElement();
    // Not merely invisible: nothing was requested either.
    expect(loadedUids).toEqual([]);
  });

  it('loads the notebook it was given', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    const { loadedUids } = captureStateManager();

    render(<NotebookView uid="nb-7" />);

    expect(loadedUids).toEqual(['nb-7']);
  });

  // The reason this component exists: the same editable document the route renders, with no route.
  it('renders the editable document once it has loaded', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    // The edit toggle is the thing being asserted, and it is hidden without write permission.
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    const { instances } = captureStateManager();

    render(<NotebookView uid="nb-1" />);

    await act(async () => {
      instances[0].setState({ isLoading: false, scene: aNotebookScene() });
    });

    expect(await screen.findByRole('radio', { name: 'Edit' })).toBeInTheDocument();
  });

  // The sticky controls row offsets itself by the app header's height, which is not this host's
  // coordinate space -- left alone the row floats over the first cells as they scroll past it.
  it('tells the scene it has no app header above it', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    const { instances } = captureStateManager();
    const scene = aNotebookScene();

    render(<NotebookView uid="nb-1" />);

    await act(async () => {
      instances[0].setState({ isLoading: false, scene });
    });

    expect(scene.state.embedded).toBe(true);
  });

  // A host that shows this in a tab has only this to label the tab with.
  it('reports the title to its host', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    const { instances } = captureStateManager();
    const onTitleChange = jest.fn();

    render(<NotebookView uid="nb-1" onTitleChange={onTitleChange} />);

    await act(async () => {
      instances[0].setState({ isLoading: false, scene: aNotebookScene('Q2 latency regression') });
    });

    expect(onTitleChange).toHaveBeenCalledWith('Q2 latency regression');
  });

  // Without the route's breadcrumb to carry it, the body is the only place the difference between
  // "no such notebook" and "we could not fetch it" can show.
  it('says so when the notebook does not exist', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    const { instances } = captureStateManager();

    render(<NotebookView uid="gone" />);

    await act(async () => {
      instances[0].setState({ isLoading: false, loadError: { status: 404, message: 'not found' } });
    });

    expect(await screen.findByText(/Notebook not found/i)).toBeInTheDocument();
    expect(screen.queryByTestId('notebook-view-error')).not.toBeInTheDocument();
  });

  it('surfaces the detail of any other failure', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    const { instances } = captureStateManager();

    render(<NotebookView uid="nb-1" />);

    await act(async () => {
      instances[0].setState({ isLoading: false, loadError: { status: 403, message: 'You lack permission' } });
    });

    expect(await screen.findByTestId('notebook-view-error')).toHaveTextContent('You lack permission');
  });

  // Its manager is its own, so nothing else clears it: a host unmounting the tab has to leave no
  // scene behind, or the next notebook opened here flashes the previous one first.
  it('drops its notebook when the host unmounts it', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    const { instances } = captureStateManager();

    const { unmount } = render(<NotebookView uid="nb-1" />);

    await act(async () => {
      instances[0].setState({ isLoading: false, scene: aNotebookScene() });
    });

    await act(async () => {
      unmount();
    });

    expect(instances[0].state.scene).toBeUndefined();
  });
});
