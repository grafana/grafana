import { t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Box, Sidebar } from '@grafana/ui';

import { getDashboardSceneLike } from '../../scene/types/dashboard';

import {
  DashboardPredefinedVariablesOptions,
  type PredefinedVariablesDashboard,
} from './DashboardPredefinedVariablesOptions';

export class DashboardPredefinedVariablesPane extends SceneObjectBase {
  public static Component = DashboardPredefinedVariablesPaneRenderer;

  public getId() {
    return 'predefined-variables' as const;
  }
}

function isPredefinedVariablesDashboard(
  scene: ReturnType<typeof getDashboardSceneLike>
): scene is PredefinedVariablesDashboard {
  return 'refreshPredefinedVariables' in scene && 'serializer' in scene && 'managedResourceCannotBeEdited' in scene;
}

function DashboardPredefinedVariablesPaneRenderer({ model }: SceneComponentProps<DashboardPredefinedVariablesPane>) {
  // Prefer getDashboardSceneLike over getDashboardSceneFor(utils) — the utils import
  // closes a new circular dep through DashboardEditPaneRenderer.
  const scene = getDashboardSceneLike(model);
  if (!isPredefinedVariablesDashboard(scene)) {
    throw new Error('SceneObject root does not support predefined variable controls');
  }

  return (
    <Box display="flex" direction="column" flex={1} height="100%" minHeight={0}>
      <Sidebar.PaneHeader title={t('dashboard.predefined-variables-pane.title', 'Predefined variables')} />
      <Box padding={2}>
        <DashboardPredefinedVariablesOptions dashboard={scene} />
      </Box>
    </Box>
  );
}
