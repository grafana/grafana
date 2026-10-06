import { type SceneVariable, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

const deactivateDashboards: Array<() => void> = [];

// Registered for every test file importing this module, like testing-library's automatic cleanup
afterEach(() => {
  deactivateDashboards.splice(0).forEach((deactivate) => deactivate());
});

/**
 * Adds the variable to a dashboard in edit mode, so changes made in inline (sidebar) editors are recorded
 * in the dashboard undo history. The dashboard is deactivated after each test.
 */
export function addToEditedDashboard(variable: SceneVariable) {
  const dashboard = new DashboardScene({
    $variables: new SceneVariableSet({ variables: [variable] }),
    isEditing: true,
    body: AutoGridLayoutManager.createEmpty(),
  });
  deactivateDashboards.push(activateFullSceneTree(dashboard));

  return dashboard.state.sidebar;
}
