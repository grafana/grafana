import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { type SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Box, Button, Sidebar, Text, useStyles2 } from '@grafana/ui';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardRulesFlowEditor } from '../settings/DashboardRulesFlowEditor';
import { getDashboardSceneFor } from '../utils/utils';

export class DashboardRulesPane extends SceneObjectBase {
  public static Component = DashboardRulesPaneRenderer;
  public getId() {
    return 'rules' as const;
  }
}

export function DashboardRulesPaneRenderer({ model }: SceneComponentProps<DashboardRulesPane>) {
  const styles = useStyles2(getStyles);
  const dashboard = getDashboardSceneFor(model);
  const { isEditing, dashboardRules } = dashboard.useState() as ReturnType<DashboardScene['useState']> & {
    dashboardRules?: { state: { rules: unknown[] } };
  };
  const ruleCount = dashboardRules?.state.rules.length ?? 0;

  const openRulesStudio = () => {
    locationService.partial({ editview: 'rules' });
  };

  return (
    <Box display="flex" direction="column" flex={1} height="100%">
      <Sidebar.PaneHeader title="Rules">
        <Button variant="secondary" size="sm" icon="cog" onClick={openRulesStudio}>
          Rules
        </Button>
      </Sidebar.PaneHeader>
      <Box padding={1} display="flex" direction="column" flex={1}>
        {ruleCount === 0 ? (
          <Box display="flex" direction="column" alignItems="center" justifyContent="center" flex={1} gap={1}>
            <Text variant="body" color="secondary">
              No rules configured for this dashboard.
            </Text>
            {isEditing && (
              <Text variant="bodySmall" color="secondary">
                Open dashboard settings to add rules.
              </Text>
            )}
          </Box>
        ) : (
          <div className={styles.flowContainer}>
            <DashboardRulesFlowEditor dashboard={dashboard} readOnly={!isEditing} />
          </div>
        )}
      </Box>
    </Box>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    flowContainer: css({
      flex: 1,
      minHeight: 400,
      display: 'flex',
      flexDirection: 'column',
    }),
  };
}
