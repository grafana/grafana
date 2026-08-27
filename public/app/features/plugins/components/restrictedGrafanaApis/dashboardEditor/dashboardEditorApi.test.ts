import { SceneObjectBase, type SceneObjectState } from '@grafana/scenes';
import { StateManagerBase } from 'app/core/services/StateManagerBase';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { DashboardDiffPane } from 'app/features/dashboard-scene/sidebar/DashboardDiffPane';

import { dashboardEditorApi } from './dashboardEditorApi';

jest.mock('app/features/dashboard-scene/pages/DashboardScenePageStateManager', () => ({
  getDashboardScenePageStateManager: jest.fn(),
}));

/** A pane that is not the diff pane, to check the api does not confuse the two. */
class OtherPane extends SceneObjectBase {
  public getId() {
    return 'code' as const;
  }
}

interface FakeSidebarState extends SceneObjectState {
  openPane?: DashboardDiffPane | OtherPane;
}

class FakeSidebar extends SceneObjectBase<FakeSidebarState> {
  public openPane = jest.fn();
}

interface FakeDashboardState extends SceneObjectState {
  sidebar: FakeSidebar;
}

/**
 * A real SceneObjectBase so isActive behaves exactly as it does on DashboardScene, with only the
 * members the API touches stubbed out.
 */
class FakeDashboardScene extends SceneObjectBase<FakeDashboardState> {}

function setup({ activate = true }: { activate?: boolean } = {}) {
  const scene = new FakeDashboardScene({ sidebar: new FakeSidebar({}) });
  if (activate) {
    scene.activate();
  }

  const stateManager = new StateManagerBase<{ dashboard?: FakeDashboardScene }>({ dashboard: scene });
  jest.mocked(getDashboardScenePageStateManager).mockReturnValue(stateManager as never);

  return { scene, stateManager };
}

function setupWithoutDashboard() {
  const stateManager = new StateManagerBase<{ dashboard?: FakeDashboardScene }>({});
  jest.mocked(getDashboardScenePageStateManager).mockReturnValue(stateManager as never);
  return { stateManager };
}

describe('dashboardEditorApi', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('exposes openDiffView and nothing else', () => {
    expect(Object.keys(dashboardEditorApi)).toEqual(['openDiffView']);
  });

  describe('openDiffView', () => {
    it('opens the diff pane with the given texts', () => {
      const { scene } = setup();

      dashboardEditorApi.openDiffView({ original: 'a', current: 'b', title: 'Turn 3' });

      expect(scene.state.sidebar.openPane).toHaveBeenCalledTimes(1);
      const pane = scene.state.sidebar.openPane.mock.calls[0][0];
      expect(pane).toBeInstanceOf(DashboardDiffPane);
      expect(pane.state).toMatchObject({ original: 'a', current: 'b', title: 'Turn 3' });
    });

    it('updates the open diff pane instead of re-opening it', () => {
      const { scene } = setup();
      const openPane = new DashboardDiffPane({ original: 'a', current: 'b' });
      scene.state.sidebar.setState({ openPane });

      dashboardEditorApi.openDiffView({ original: 'c', current: 'd', title: 'Turn 4' });

      expect(scene.state.sidebar.openPane).not.toHaveBeenCalled();
      expect(openPane.state).toMatchObject({ original: 'c', current: 'd', title: 'Turn 4' });
    });

    it('clears a previous title when called again without one', () => {
      const { scene } = setup();
      const openPane = new DashboardDiffPane({ original: 'a', current: 'b', title: 'Turn 3' });
      scene.state.sidebar.setState({ openPane });

      dashboardEditorApi.openDiffView({ original: 'c', current: 'd' });

      expect(openPane.state.title).toBeUndefined();
    });

    it('opens the diff pane when a different pane is open', () => {
      const { scene } = setup();
      scene.state.sidebar.setState({ openPane: new OtherPane({}) });

      dashboardEditorApi.openDiffView({ original: 'a', current: 'b' });

      expect(scene.state.sidebar.openPane).toHaveBeenCalledTimes(1);
    });

    it('does nothing when no dashboard is loaded', () => {
      setupWithoutDashboard();

      expect(() => dashboardEditorApi.openDiffView({ original: 'a', current: 'b' })).not.toThrow();
    });

    it('does nothing when the loaded dashboard is no longer on screen', () => {
      const { scene } = setup({ activate: false });

      dashboardEditorApi.openDiffView({ original: 'a', current: 'b' });

      expect(scene.state.sidebar.openPane).not.toHaveBeenCalled();
    });
  });
});
