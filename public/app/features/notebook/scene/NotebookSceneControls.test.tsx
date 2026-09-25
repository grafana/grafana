import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { act, getWrapper, render, screen } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';
import { KioskMode } from 'app/types/dashboard';

import { NotebookScene } from './NotebookScene';
import { NotebookSceneControls } from './NotebookSceneControls';
import { NotebookCellItem } from './layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from './layout-notebook/NotebookLayoutManager';

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

// activate() registers the scene on window.__grafanaSceneContext; leaving it registered leaks into
// later tests in this file.
const deactivators: Array<() => void> = [];
function activate(scene: NotebookScene) {
  deactivators.push(scene.activate());
}

describe('NotebookSceneControls', () => {
  beforeEach(() => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  // Wrapped in act(): these controls subscribe to scene state, so deactivating while they are
  // still mounted publishes an update React would otherwise report as unwrapped.
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

  // A property of the notebook, not of the surface rendering it, which is why this stays inside the
  // controls rather than becoming a prop.
  it('hides the time controls when the notebook asks for them to be hidden', () => {
    const scene = buildScene(true);
    activate(scene);

    render(<NotebookSceneControls model={scene} stickyOffset={0} />);

    expect(screen.queryByRole('button', { name: /Time range selected/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refresh time interval/i })).not.toBeInTheDocument();
  });

  // Awaited because entering edit mode also mounts the header's tag picker, whose dropdown measures
  // itself once mounted. That lands after the act above, so a synchronous assertion here leaves an
  // unwrapped update behind and the console guard fails the test.
  it('offers the history controls only in edit mode', async () => {
    const scene = buildScene();
    activate(scene);
    render(<NotebookSceneControls model={scene} stickyOffset={0} />);

    expect(screen.queryByRole('button', { name: /Undo/ })).not.toBeInTheDocument();

    act(() => scene.onEnterEditMode());

    expect(await screen.findByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  // The assistant writes without entering edit mode, so gating the status on `isEditing` would hide a
  // failed save from the only person who could retry it.
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

  // A display someone has put a notebook on. The editing affordances go, but the time controls stay
  // — a live display may well want the range visible, which is what separates this from a capture.
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
    // Still there: kiosk is not a capture.
    expect(screen.getByRole('button', { name: /Time range selected/ })).toBeInTheDocument();
  });
});
