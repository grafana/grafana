import { t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase, type SceneObjectState } from '@grafana/scenes';
import { Box, Sidebar } from '@grafana/ui';

import { getDashboardSceneLike } from '../../scene/types/dashboard';

import {
  DashboardCrossDashboardVariablesOptions,
  type CrossDashboardVariablesDashboard,
} from './DashboardCrossDashboardVariablesOptions';

export interface DashboardCrossDashboardVariablesPaneState extends SceneObjectState {
  /** Opened from Add filter: only ad hoc and group-by variables are listed. */
  filtersOnly?: boolean;
}

export class DashboardCrossDashboardVariablesPane extends SceneObjectBase<DashboardCrossDashboardVariablesPaneState> {
  public static Component = DashboardCrossDashboardVariablesPaneRenderer;

  public getId() {
    return 'cross-dashboard-variables' as const;
  }
}

function isCrossDashboardVariablesDashboard(
  scene: ReturnType<typeof getDashboardSceneLike>
): scene is CrossDashboardVariablesDashboard {
  return 'setUseCrossDashboardVariables' in scene && 'serializer' in scene && 'managedResourceCannotBeEdited' in scene;
}

function DashboardCrossDashboardVariablesPaneRenderer({
  model,
}: SceneComponentProps<DashboardCrossDashboardVariablesPane>) {
  const { filtersOnly } = model.useState();
  // Prefer getDashboardSceneLike over getDashboardSceneFor(utils) — the utils import
  // closes a new circular dep through DashboardSidebarRenderer.
  const scene = getDashboardSceneLike(model);
  if (!isCrossDashboardVariablesDashboard(scene)) {
    throw new Error('SceneObject root does not support cross-dashboard variable controls');
  }

  return (
    <Box display="flex" direction="column" flex={1} height="100%" minHeight={0}>
      <Sidebar.PaneHeader
        title={
          filtersOnly
            ? t('dashboard.sidebar.filters.global-or-folder-title', 'Global or folder filter variable')
            : t('dashboard.sidebar.cross-dashboard-variables.pane-header', 'Global or folder variable')
        }
      />
      <Box padding={2}>
        <DashboardCrossDashboardVariablesOptions dashboard={scene} filtersOnly={filtersOnly} />
      </Box>
    </Box>
  );
}
