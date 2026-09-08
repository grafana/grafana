import { t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Box, Sidebar } from '@grafana/ui';

import { getDashboardSceneLike } from '../../scene/types/dashboard';

import {
  DashboardCrossDashboardVariablesOptions,
  type CrossDashboardVariablesDashboard,
} from './DashboardCrossDashboardVariablesOptions';

export class DashboardPredefinedVariablesPane extends SceneObjectBase {
  public static Component = DashboardPredefinedVariablesPaneRenderer;

  public getId() {
    return 'predefined-variables' as const;
  }
}

function isCrossDashboardVariablesDashboard(
  scene: ReturnType<typeof getDashboardSceneLike>
): scene is CrossDashboardVariablesDashboard {
  return 'refreshPredefinedVariables' in scene && 'serializer' in scene && 'managedResourceCannotBeEdited' in scene;
}

function DashboardPredefinedVariablesPaneRenderer({ model }: SceneComponentProps<DashboardPredefinedVariablesPane>) {
  // Prefer getDashboardSceneLike over getDashboardSceneFor(utils) — the utils import
  // closes a new circular dep through DashboardSidebarRenderer.
  const scene = getDashboardSceneLike(model);
  if (!isCrossDashboardVariablesDashboard(scene)) {
    throw new Error('SceneObject root does not support predefined variable controls');
  }

  return (
    <Box display="flex" direction="column" flex={1} height="100%" minHeight={0}>
      <Sidebar.PaneHeader
        title={t('dashboard.sidebar.cross-dashboard-variables.pane-header', 'Cross-dashboard variables')}
      />
      <Box padding={2}>
        <DashboardCrossDashboardVariablesOptions dashboard={scene} />
      </Box>
    </Box>
  );
}
