import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Alert, Box, useStyles2 } from '@grafana/ui';

import { DashboardScene } from '../scene/DashboardScene';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardRulesFlowEditor } from './DashboardRulesFlowEditor';
import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from './utils';

export class DashboardRulesEditView extends SceneObjectBase<DashboardEditViewState> implements DashboardEditView {
  static Component = DashboardRulesEditViewRenderer;

  private get _dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public getUrlKey(): string {
    return 'rules';
  }

  public getDashboard(): DashboardScene {
    return this._dashboard;
  }
}

function DashboardRulesEditViewRenderer({ model }: SceneComponentProps<DashboardRulesEditView>) {
  const dashboard = model.getDashboard();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
  const styles = useStyles2(getStyles);

  const isFeatureEnabled = config.featureToggles.dashboardRules;

  if (!isFeatureEnabled) {
    return (
      <Box padding={2}>
        <Alert severity="info" title="Dashboard rules">
          Dashboard rules are not enabled. Enable the dashboardRules feature toggle to use this feature.
        </Alert>
      </Box>
    );
  }

  return (
    <div className={styles.container}>
      <DashboardRulesFlowEditor dashboard={dashboard} />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      height: '100%',
      minHeight: 600,
    }),
  };
}
