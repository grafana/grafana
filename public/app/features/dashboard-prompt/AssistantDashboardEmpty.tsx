import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { type ChatContextItem } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Icon, Stack, useStyles2 } from '@grafana/ui';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { DashboardLandingPrompt } from './DashboardLandingPrompt';
import { getPromptDatasources } from './datasources';
import { startPlanningInAssistant } from './handoff';

interface Props {
  dashboard: DashboardScene;
}

export function AssistantDashboardEmpty({ dashboard }: Props) {
  const styles = useStyles2(getStyles);
  const { sidebar } = dashboard.useState();
  // Set at scene activation when the URL has editSource=assistant
  // (create_dashboard), or on submit from this landing so the same session
  // tag applies without a remount.
  const [assistantDriven, setAssistantDriven] = useState(() => dashboard.getEditSessionSource() === 'assistant');

  const onAddVisualization = () => {
    sidebar.addNewPanel(sidebar.getSelectedObject());
  };

  const onSubmitPrompt = useCallback((prompt: string, contextItems: ChatContextItem[]) => {
    const selectedDatasources = contextItems.flatMap(({ node }) => {
      const data = node.data;
      if (data?.type !== 'datasource' || typeof data.datasourceUid !== 'string') {
        return [];
      }
      return [
        {
          uid: data.datasourceUid,
          type: typeof data.datasourceType === 'string' ? data.datasourceType : 'unknown',
          name: typeof data.datasourceName === 'string' ? data.datasourceName : node.name,
        },
      ];
    });
    const dashboards = contextItems.flatMap(({ node }) => {
      const data = node.data;
      if (data?.type !== 'dashboard' || typeof data.dashboardUid !== 'string') {
        return [];
      }
      return [
        {
          uid: data.dashboardUid,
          title: typeof data.dashboardTitle === 'string' ? data.dashboardTitle : node.name,
        },
      ];
    });

    startPlanningInAssistant({
      request: prompt,
      displayPrompt: prompt,
      datasources: selectedDatasources.length > 0 ? selectedDatasources : getPromptDatasources(),
      context: contextItems,
      dashboards,
    });

    setAssistantDriven(true);
    reportInteraction('dashboard_prompt_planning_started', { source: 'empty_dashboard' });
  }, []);

  useEffect(() => {
    if (!assistantDriven) {
      return;
    }
    if (sidebar.state.openPane?.getId() === 'add') {
      sidebar.closePane();
    }
  }, [assistantDriven, sidebar]);

  return (
    <div className={styles.root}>
      <div className={styles.content}>
        <Stack alignItems="center" direction="column" gap={2}>
          <Icon name="apps" size="xxl" className={styles.appsIcon} />
          <h2 className={styles.title}>
            <Trans i18nKey="dashboard.empty.build-assistant">Build your dashboard with Assistant</Trans>
          </h2>
          <div className={styles.prompt}>
            <DashboardLandingPrompt onSubmit={onSubmitPrompt} />
          </div>
        </Stack>

        <div className={styles.divider}>
          <div className={styles.orLine} />
          <span className={styles.orText}>
            <Trans i18nKey="dashboard.empty.or-start-blank">Or build it yourself</Trans>
          </span>
          <div className={styles.orLine} />
        </div>

        <Button
          icon="plus"
          variant="secondary"
          className={styles.addButton}
          data-testid={selectors.pages.AddDashboard.itemButton('Create new panel button')}
          onClick={onAddVisualization}
        >
          <Trans i18nKey="dashboard.empty.add-visualization-button">Add visualization</Trans>
        </Button>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    root: css({
      position: 'relative',
      display: 'flex',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      minHeight: '100%',
    }),
    content: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(4),
      width: '100%',
      maxWidth: 660,
      padding: theme.spacing(6, 4),
    }),
    appsIcon: css({
      fill: theme.v1.palette.orange,
    }),
    title: css({
      margin: 0,
      fontSize: theme.typography.h2.fontSize,
      fontWeight: theme.typography.fontWeightBold,
      letterSpacing: '-0.01em',
      textAlign: 'center',
    }),
    prompt: css({
      width: '100%',
    }),
    divider: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
    }),
    orLine: css({
      flex: 1,
      height: 1,
      background: theme.colors.border.weak,
    }),
    orText: css({
      color: theme.colors.text.disabled,
      fontSize: theme.typography.bodySmall.fontSize,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }),
    addButton: css({
      width: '100%',
      justifyContent: 'center',
    }),
  };
}
