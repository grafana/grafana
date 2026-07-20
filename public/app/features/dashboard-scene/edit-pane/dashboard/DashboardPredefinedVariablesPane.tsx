import { t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Box, Sidebar } from '@grafana/ui';

import { getDashboardSceneFor } from '../../utils/utils';

import { DashboardPredefinedVariablesOptions } from './DashboardPredefinedVariablesOptions';

export class DashboardPredefinedVariablesPane extends SceneObjectBase {
  public static Component = DashboardPredefinedVariablesPaneRenderer;

  public getId() {
    return 'predefined-variables' as const;
  }
}

function DashboardPredefinedVariablesPaneRenderer({ model }: SceneComponentProps<DashboardPredefinedVariablesPane>) {
  const dashboard = getDashboardSceneFor(model);

  return (
    <Box display="flex" direction="column" flex={1} height="100%" minHeight={0}>
      <Sidebar.PaneHeader title={t('dashboard.predefined-variables-pane.title', 'Predefined variables')} />
      <Box padding={2}>
        <DashboardPredefinedVariablesOptions dashboard={dashboard} />
      </Box>
    </Box>
  );
}
