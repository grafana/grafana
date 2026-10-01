import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { act, getWrapper, render, screen } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { config, setPluginImportUtils } from '@grafana/runtime';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';
import { KioskMode } from 'app/types/dashboard';

import { NotebookEmbeddedHost } from './NotebookEmbeddedContext';
import { NotebookScene } from './NotebookScene';
import { NotebookSceneControls } from './NotebookSceneControls';
import { NotebookCellItem } from './layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from './layout-notebook/NotebookLayoutManager';

const VISUAL_REFRESH_FLAG = 'grafana.visualDesignRefresh';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

function buildScene(hideTimeControls = false) {
  return new NotebookScene({
    title: 'My notebook',
    uid: 'nb1',
    body: new NotebookLayoutManager({
      cells: [
        new NotebookCellItem({
          elementName: 'md1',
          source: 'user',
          content: { kind: 'Markdown', spec: { text: 'Hello' } },
        }),
      ],
    }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
    hideTimeControls,
  });
}

const deactivators: Array<() => void> = [];
function activate(scene: NotebookScene) {
  deactivators.push(scene.activate());
}

describe('NotebookSceneControls', () => {
  beforeEach(() => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  afterEach(() => {
    act(() => {
      deactivators.splice(0).forEach((deactivate) => deactivate());
    });
    jest.restoreAllMocks();
  });

  it('shows the time controls', () => {
    const scene = buildScene();
    activate(scene);

    render(<NotebookSceneControls model={scene} stickyOffset={0} />);

    expect(screen.getByRole('button', { name: /Time range selected/ })).toBeInTheDocument();
  });

  it('hides the time controls when the notebook asks for them to be hidden', () => {
    const scene = buildScene(true);
    activate(scene);

    render(<NotebookSceneControls model={scene} stickyOffset={0} />);

    expect(screen.queryByRole('button', { name: /Time range selected/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refresh time interval/i })).not.toBeInTheDocument();
  });

  it('offers the history controls only in edit mode', async () => {
    const scene = buildScene();
    activate(scene);
    render(<NotebookSceneControls model={scene} stickyOffset={0} />);

    expect(screen.queryByRole('button', { name: /Undo/ })).not.toBeInTheDocument();

    act(() => scene.onEnterEditMode());

    expect(await screen.findByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('reports a save outside edit mode, where the assistant writes', () => {
    const scene = buildScene();
    activate(scene);
    render(<NotebookSceneControls model={scene} stickyOffset={0} />);

    expect(screen.queryByText('Save failed')).not.toBeInTheDocument();

    act(() => scene.autosave.setState({ status: 'error', errorMessage: 'The notebook was changed by someone else.' }));

    expect(scene.state.isEditing).toBeUndefined();
    expect(screen.getByText('Save failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('hides save status, the edit toggle and history controls when kiosk mode is full', () => {
    const scene = buildScene();
    activate(scene);
    act(() => scene.onEnterEditMode());
    act(() => scene.autosave.setState({ status: 'error', errorMessage: 'The notebook was changed by someone else.' }));

    const context = getGrafanaContextMock();
    context.chrome.update({ kioskMode: KioskMode.Full });
    const wrapper = getWrapper({ renderWithRouter: true, grafanaContext: context });
    render(<NotebookSceneControls model={scene} stickyOffset={0} />, { wrapper });

    expect(screen.queryByText('Save failed')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Time range selected/ })).toBeInTheDocument();
  });
  describe('sticky background', () => {
    afterEach(async () => {
      await act(async () => {
        setTestFlags({});
      });
    });

    function controlsRow() {
      return screen.getByTestId(selectors.pages.Notebooks.Item.controls);
    }

    it('matches the page background on the /notebooks route', async () => {
      await act(async () => {
        setTestFlags({ [VISUAL_REFRESH_FLAG]: true });
      });
      const scene = buildScene();
      activate(scene);

      render(<NotebookSceneControls model={scene} stickyOffset={0} />);

      expect(controlsRow()).toHaveStyle({ background: config.theme2.colors.background.page });
    });

    it('falls back to the canvas background when embedded with no host override', async () => {
      await act(async () => {
        setTestFlags({ [VISUAL_REFRESH_FLAG]: true });
      });
      const scene = buildScene();
      activate(scene);

      render(
        <NotebookEmbeddedHost>
          <NotebookSceneControls model={scene} stickyOffset={0} />
        </NotebookEmbeddedHost>
      );

      expect(controlsRow()).toHaveStyle({ background: config.theme2.colors.background.canvas });
    });

    it('uses the host-supplied background when embedded with an override', () => {
      const scene = buildScene();
      activate(scene);

      render(
        <NotebookEmbeddedHost controlsBackground="rebeccapurple">
          <NotebookSceneControls model={scene} stickyOffset={0} />
        </NotebookEmbeddedHost>
      );

      expect(controlsRow()).toHaveStyle({ background: 'rebeccapurple' });
    });
  });
});
