import { SceneObjectBase, type SceneObjectState } from '@grafana/scenes';
import { StateManagerBase } from 'app/core/services/StateManagerBase';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { DashboardDiffPane } from 'app/features/dashboard-scene/sidebar/DashboardDiffPane';

import { dashboardEditorApi } from './dashboardEditorApi';

jest.mock('app/features/dashboard-scene/pages/DashboardScenePageStateManager', () => ({
  getDashboardScenePageStateManager: jest.fn(),
}));

interface FakeDashboardState extends SceneObjectState {
  isDirty?: boolean;
  isEditing?: boolean;
  sidebar: { openPane: jest.Mock; state: { openPane?: { getId: () => string } } };
}

/**
 * A real SceneObjectBase so subscribeToState / isActive behave exactly as they do on
 * DashboardScene, with only the two members the API touches stubbed out.
 */
class FakeDashboardScene extends SceneObjectBase<FakeDashboardState> {
  public getDashboardChanges = jest.fn(() => ({
    diffCount: 0,
    hasFolderChanges: false,
    hasPredefinedVariablesChanges: false,
  }));
}

function setup({ activate = true }: { activate?: boolean } = {}) {
  const scene = new FakeDashboardScene({ isDirty: false, sidebar: { openPane: jest.fn(), state: {} } });
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

  describe('hasUnsavedChanges', () => {
    it('reports no changes when the dashboard matches its last saved version', () => {
      setup();

      expect(dashboardEditorApi.hasUnsavedChanges()).toBe(false);
    });

    it.each([
      ['spec changes', { diffCount: 3, hasFolderChanges: false, hasPredefinedVariablesChanges: false }],
      ['a folder move', { diffCount: 0, hasFolderChanges: true, hasPredefinedVariablesChanges: false }],
      ['predefined variable changes', { diffCount: 0, hasFolderChanges: false, hasPredefinedVariablesChanges: true }],
    ])('reports changes for %s', (_name, changes) => {
      const { scene } = setup();
      scene.getDashboardChanges.mockReturnValue(changes);

      expect(dashboardEditorApi.hasUnsavedChanges()).toBe(true);
    });

    it('reports no changes when no dashboard is loaded', () => {
      setupWithoutDashboard();

      expect(dashboardEditorApi.hasUnsavedChanges()).toBe(false);
    });

    it('reports no changes when the loaded dashboard is no longer on screen', () => {
      const { scene } = setup({ activate: false });
      scene.getDashboardChanges.mockReturnValue({
        diffCount: 3,
        hasFolderChanges: false,
        hasPredefinedVariablesChanges: false,
      });

      expect(dashboardEditorApi.hasUnsavedChanges()).toBe(false);
      expect(scene.getDashboardChanges).not.toHaveBeenCalled();
    });
  });

  describe('subscribeToChanges', () => {
    it('fires when the dashboard becomes dirty and when it is saved again', () => {
      const { scene } = setup();
      const cb = jest.fn();

      dashboardEditorApi.subscribeToChanges(cb);

      scene.setState({ isDirty: true });
      expect(cb).toHaveBeenCalledTimes(1);

      scene.setState({ isDirty: false });
      expect(cb).toHaveBeenCalledTimes(2);
    });

    it('does not serialize the dashboard while it stays clean', () => {
      const { scene } = setup();
      const cb = jest.fn();

      dashboardEditorApi.subscribeToChanges(cb);

      scene.setState({ key: 'a' });
      scene.setState({ key: 'b' });
      scene.setState({ isDirty: false });

      expect(cb).not.toHaveBeenCalled();
      expect(scene.getDashboardChanges).not.toHaveBeenCalled();
    });

    it('fires when the dashboard enters or leaves edit mode', () => {
      const { scene } = setup();
      const cb = jest.fn();

      dashboardEditorApi.subscribeToChanges(cb);

      scene.setState({ isEditing: true });
      scene.setState({ isEditing: false });

      expect(cb).toHaveBeenCalledTimes(2);
    });

    it('does not fire again while the dashboard stays dirty', () => {
      const { scene } = setup();
      const cb = jest.fn();

      dashboardEditorApi.subscribeToChanges(cb);

      scene.setState({ isDirty: true });
      scene.setState({ key: 'a' });
      scene.setState({ isDirty: true });

      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('follows the active dashboard when the user opens another one', () => {
      const { scene, stateManager } = setup();
      const cb = jest.fn();

      dashboardEditorApi.subscribeToChanges(cb);

      const nextScene = new FakeDashboardScene({ isDirty: false, sidebar: { openPane: jest.fn(), state: {} } });
      nextScene.activate();
      stateManager.setState({ dashboard: nextScene });
      expect(cb).toHaveBeenCalledTimes(1);

      nextScene.setState({ isDirty: true });
      expect(cb).toHaveBeenCalledTimes(2);

      // The dashboard that was replaced must no longer reach the subscriber.
      scene.setState({ isDirty: true });
      expect(cb).toHaveBeenCalledTimes(2);
    });

    it('ignores unrelated page state changes', () => {
      const { stateManager } = setup();
      const cb = jest.fn();

      dashboardEditorApi.subscribeToChanges(cb);

      stateManager.setState({});

      expect(cb).not.toHaveBeenCalled();
    });

    it('subscribes without a dashboard loaded and picks one up when it arrives', () => {
      const { stateManager } = setupWithoutDashboard();
      const cb = jest.fn();

      dashboardEditorApi.subscribeToChanges(cb);

      const scene = new FakeDashboardScene({ isDirty: false, sidebar: { openPane: jest.fn(), state: {} } });
      scene.activate();
      stateManager.setState({ dashboard: scene });
      expect(cb).toHaveBeenCalledTimes(1);

      scene.setState({ isDirty: true });
      expect(cb).toHaveBeenCalledTimes(2);
    });

    it('stops firing once unsubscribed', () => {
      const { scene, stateManager } = setup();
      const cb = jest.fn();

      const unsubscribe = dashboardEditorApi.subscribeToChanges(cb);
      unsubscribe();

      scene.setState({ isDirty: true });
      stateManager.setState({ dashboard: undefined });

      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('isEditing', () => {
    it.each([
      [true, true],
      [false, false],
      [undefined, false],
    ])('reports %s as %s', (isEditing, expected) => {
      const { scene } = setup();
      scene.setState({ isEditing });

      expect(dashboardEditorApi.isEditing()).toBe(expected);
    });

    it('reports false when no dashboard is on screen', () => {
      setupWithoutDashboard();

      expect(dashboardEditorApi.isEditing()).toBe(false);
    });

    it('reports false when the loaded dashboard is no longer on screen', () => {
      const { scene } = setup({ activate: false });
      scene.setState({ isEditing: true });

      expect(dashboardEditorApi.isEditing()).toBe(false);
    });
  });

  describe('openDiffView', () => {
    it('opens the diff pane in the dashboard sidebar', () => {
      const { scene } = setup();

      dashboardEditorApi.openDiffView();

      expect(scene.state.sidebar.openPane).toHaveBeenCalledTimes(1);
      expect(scene.state.sidebar.openPane.mock.calls[0][0]).toBeInstanceOf(DashboardDiffPane);
    });

    it('does nothing when no dashboard is loaded', () => {
      setupWithoutDashboard();

      expect(() => dashboardEditorApi.openDiffView()).not.toThrow();
    });

    it('does nothing when the loaded dashboard is no longer on screen', () => {
      const { scene } = setup({ activate: false });

      dashboardEditorApi.openDiffView();

      expect(scene.state.sidebar.openPane).not.toHaveBeenCalled();
    });

    it('does nothing when the diff pane is already open', () => {
      const { scene } = setup();
      scene.state.sidebar.state.openPane = { getId: () => 'diff' };

      dashboardEditorApi.openDiffView();

      expect(scene.state.sidebar.openPane).not.toHaveBeenCalled();
    });

    it('opens the diff pane when a different pane is open', () => {
      const { scene } = setup();
      scene.state.sidebar.state.openPane = { getId: () => 'code' };

      dashboardEditorApi.openDiffView();

      expect(scene.state.sidebar.openPane).toHaveBeenCalledTimes(1);
    });
  });
});
