/**
 * Dashboard Editor API -- restricted API for plugins that need to reason about, and surface, the
 * unsaved state of the dashboard the user is editing.
 *
 * The dashboard page state manager owns the scene that is currently on screen, so it is both the
 * source of truth for "which dashboard" and the signal for "the dashboard was swapped". Plugins
 * access this through the RestrictedGrafanaApis context -- they cannot import this module directly
 * because it lives inside the core bundle.
 */

import { type Unsubscribable } from 'rxjs';

import type { DashboardEditorAPI } from '@grafana/data';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import type { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DashboardDiffPane } from 'app/features/dashboard-scene/sidebar/DashboardDiffPane';
import { hasActualSaveChanges } from 'app/features/dashboard-scene/utils/utils';

function getActiveDashboard(): DashboardScene | undefined {
  const { dashboard } = getDashboardScenePageStateManager().state;
  // The state manager keeps the last loaded dashboard after the user navigates elsewhere, so an
  // inactive scene means there is no dashboard on screen to report on or open a pane in.
  return dashboard?.isActive ? dashboard : undefined;
}

export const dashboardEditorApi: DashboardEditorAPI = {
  hasUnsavedChanges: () => {
    const dashboard = getActiveDashboard();
    return dashboard ? hasActualSaveChanges(dashboard) : false;
  },

  isEditing: () => getActiveDashboard()?.state.isEditing ?? false,

  subscribeToChanges: (cb: () => void) => {
    const stateManager = getDashboardScenePageStateManager();

    let sceneSub: Unsubscribable | undefined;
    let subscribedScene: DashboardScene | undefined;

    const followScene = (dashboard: DashboardScene | undefined) => {
      sceneSub?.unsubscribe();
      sceneSub = undefined;
      subscribedScene = dashboard;

      // `isDirty` is the cheap gate: hasActualSaveChanges() serializes the whole dashboard, so
      // notifying on every scene state change would run it on every keystroke in a panel editor.
      sceneSub = dashboard?.subscribeToState((newState, prevState) => {
        if (newState.isDirty !== prevState.isDirty || newState.isEditing !== prevState.isEditing) {
          cb();
        }
      });
    };

    followScene(stateManager.state.dashboard);

    const stateManagerSub = stateManager.subscribeToState({
      next: (state) => {
        if (state.dashboard === subscribedScene) {
          return;
        }
        followScene(state.dashboard);
        cb();
      },
    });

    return () => {
      stateManagerSub.unsubscribe();
      sceneSub?.unsubscribe();
    };
  },

  openDiffView: () => {
    const sidebar = getActiveDashboard()?.state.sidebar;
    // openPane() closes the pane when the requested id already matches, so calling it
    // unconditionally would make a second click hide the diff.
    if (!sidebar || sidebar.state.openPane?.getId() === 'diff') {
      return;
    }
    sidebar.openPane(new DashboardDiffPane({}));
  },
};
