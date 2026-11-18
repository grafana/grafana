import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { type ChatContextItem } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Icon, Stack, useStyles2 } from '@grafana/ui';
import { useHoldFloatingExtensionSidebar } from 'app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider';
import { useTemplateDashboardsAvailability } from 'app/features/dashboard/dashgrid/DashboardLibrary/hooks/useTemplateDashboardsAvailability';
import { type TemplateSelection } from 'app/features/dashboard/dashgrid/DashboardLibrary/types';
import { buildAssistantPrompt } from 'app/features/dashboard/dashgrid/DashboardLibrary/utils/assistantHelpers';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { DashboardLandingPrompt } from './DashboardLandingPrompt';
import { LandingTemplates } from './LandingTemplates';
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
  // This page's own prompt stands in for the floating Assistant until it is submitted, which opens the
  // Assistant with it; opening the Assistant from the toolbar shows it too.
  useHoldFloatingExtensionSidebar(!assistantDriven);

  const { testDataSource, showGrafanaTemplates, showCustomTemplates, isAvailable } =
    useTemplateDashboardsAvailability();
  const showTemplates = isAvailable && !assistantDriven;
  // The picked template travels to the Assistant as a context pill in the prompt.
  const [template, setTemplate] = useState<TemplateSelection>();
  const hostContextItems = useMemo(() => (template ? [template.contextItem] : []), [template]);

  const onSelectTemplate = useCallback((selection: TemplateSelection) => {
    setTemplate((current) => (current?.id === selection.id ? undefined : selection));
  }, []);

  const onTemplatePillRemove = useCallback((id: string) => {
    setTemplate((current) => (current?.contextItem.node.id === id ? undefined : current));
  }, []);

  const onAddVisualization = () => {
    sidebar.addNewPanel(sidebar.getSelectedObject());
  };

  const onSubmitPrompt = useCallback(
    (prompt: string, submittedContextItems: ChatContextItem[]) => {
      // A plugin version without host pills never sends the template back, so make sure it travels.
      const templateItem = template?.contextItem;
      const contextItems =
        templateItem && !submittedContextItems.some(({ node }) => node.id === templateItem.node.id)
          ? [...submittedContextItems, templateItem]
          : submittedContextItems;
      // The prompt can be sent empty once a template is attached; the template is then the whole request.
      const request = prompt.trim() || (template ? buildAssistantPrompt(template.kind) : prompt);
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
        request,
        displayPrompt: request,
        datasources: selectedDatasources.length > 0 ? selectedDatasources : getPromptDatasources(),
        context: contextItems,
        dashboards,
      });

      setAssistantDriven(true);
      setTemplate(undefined);
      reportInteraction('dashboard_prompt_planning_started', {
        source: 'empty_dashboard',
        templateKind: template?.kind,
      });
    },
    [template]
  );

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
      <div className={cx(styles.content, showTemplates && styles.contentWithTemplates)}>
        <Stack alignItems="center" direction="column" gap={2}>
          <Icon name="apps" size="xxl" className={styles.appsIcon} />
          <h2 className={styles.title}>
            <Trans i18nKey="dashboard.empty.build-assistant">Build your dashboard with Assistant</Trans>
          </h2>
          <div className={styles.prompt}>
            <DashboardLandingPrompt
              onSubmit={onSubmitPrompt}
              placeholder={
                template
                  ? t(
                      'dashboard.empty.assistant-placeholder-template',
                      'Describe what to change in {{title}}, or send to start from it as is.',
                      { title: template.title }
                    )
                  : undefined
              }
              hostContextItems={hostContextItems}
              onHostContextItemRemove={onTemplatePillRemove}
            />
          </div>
        </Stack>

        {showTemplates && (
          <LandingTemplates
            testDataSource={testDataSource}
            showGrafanaTemplates={showGrafanaTemplates}
            showCustomTemplates={showCustomTemplates}
            onSelectTemplate={onSelectTemplate}
            selectedTemplateId={template?.id}
          />
        )}

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
    // Room for the template grid's columns under the prompt.
    contentWithTemplates: css({
      maxWidth: 1040,
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
