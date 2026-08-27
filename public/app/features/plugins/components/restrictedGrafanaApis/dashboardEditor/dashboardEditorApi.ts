/**
 * Dashboard Editor API -- restricted API for plugins that need to show a diff of dashboard specs
 * they own, in the sidebar of the dashboard the user is editing.
 *
 * The dashboard page state manager owns the scene that is currently on screen, so it is the source
 * of truth for "which dashboard". Plugins access this through the RestrictedGrafanaApis context --
 * they cannot import this module directly because it lives inside the core bundle.
 */

import type { DashboardEditorAPI } from '@grafana/data';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import type { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DashboardDiffPane } from 'app/features/dashboard-scene/sidebar/DashboardDiffPane';

function getActiveDashboard(): DashboardScene | undefined {
  const { dashboard } = getDashboardScenePageStateManager().state;
  // The state manager keeps the last loaded dashboard after the user navigates elsewhere, so an
  // inactive scene means there is no dashboard on screen to open a pane in.
  return dashboard?.isActive ? dashboard : undefined;
}

export const dashboardEditorApi: DashboardEditorAPI = {
  openDiffView: ({ original, current, title, action }) => {
    const dashboard = getActiveDashboard();
    if (!dashboard) {
      return;
    }

    const { sidebar } = dashboard.state;
    const { openPane } = sidebar.state;

    // openPane() closes the pane when the requested id already matches, so an open diff pane is
    // updated in place rather than re-opened.
    if (openPane instanceof DashboardDiffPane) {
      openPane.setState({ original, current, title, action });
      return;
    }

    sidebar.openPane(new DashboardDiffPane({ original, current, title, action }));
  },
};
