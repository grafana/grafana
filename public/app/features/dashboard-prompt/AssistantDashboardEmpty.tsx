import { css, cx, keyframes } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { type ChatContextItem, checkLimits } from '@grafana/assistant';
import { AppEvents, type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Icon, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { useHoldFloatingExtensionSidebar } from 'app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider';
import { contextSrv } from 'app/core/services/context_srv';
import { useTemplateDashboardsAvailability } from 'app/features/dashboard/dashgrid/DashboardLibrary/hooks/useTemplateDashboardsAvailability';
import { OPEN_TEMPLATE_PROMPT } from 'app/features/dashboard/dashgrid/DashboardLibrary/utils/assistantHelpers';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { DashboardLandingPrompt, PROMPT_HEIGHT } from './DashboardLandingPrompt';
import { LandingTemplates } from './LandingTemplates';
import { getPromptDatasources } from './datasources';
import { openTemplateInAssistant, startPlanningInAssistant } from './handoff';
import { useLandingTemplates } from './useLandingTemplates';

interface Props {
  dashboard: DashboardScene;
}

/** How far the template panel starts behind the prompt. */
const PROMPT_OVERLAP = 24;

/** Why the Assistant cannot take the prompt now, if it cannot: a reason to show the person. */
async function findHandoffProblem(): Promise<string | undefined> {
  if (!contextSrv.isSignedIn) {
    return t('dashboard.empty.assistant-sign-in', 'Sign in to use the Assistant.');
  }
  try {
    const { isLimitReached } = await checkLimits();
    if (isLimitReached) {
      return t('dashboard.empty.assistant-limit-reached', "You have used all of this month's Assistant prompts.");
    }
  } catch {
    // The Assistant enforces its own limit, so a check that fails must not block the prompt.
  }
  return undefined;
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
  const templates = useLandingTemplates({ showCustomTemplates });
  const { selected: template, clearSelection } = templates;

  const onAddVisualization = () => {
    sidebar.addNewPanel(sidebar.getSelectedObject());
  };

  const onSubmitPrompt = useCallback(
    async (prompt: string, contextItems: ChatContextItem[]) => {
      // The Assistant reports nothing back once it has the prompt, so check before handing it over: a failed handoff
      // must leave the prompt, the picked template and the templates as they were.
      const problem = await findHandoffProblem();
      if (problem) {
        appEvents.publish({ type: AppEvents.alertError.name, payload: [problem] });
        throw new Error(problem);
      }
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

      if (template) {
        // A plugin version without host pills never sends the template back, so make sure it travels.
        const templateItem = template.contextItem;
        const context = contextItems.some(({ node }) => node.id === templateItem.node.id)
          ? contextItems
          : [...contextItems, templateItem];
        // As in the template modal: the template opens as Use template opens it, and the Assistant adapts it.
        openTemplateInAssistant({
          templateUrl: template.url,
          // The prompt can be sent empty once a template is attached; the template is then the whole request.
          prompt: prompt.trim() || OPEN_TEMPLATE_PROMPT,
          context,
        });
      } else {
        startPlanningInAssistant({
          request: prompt,
          displayPrompt: prompt,
          datasources: selectedDatasources.length > 0 ? selectedDatasources : getPromptDatasources(),
          context: contextItems,
          dashboards,
        });
      }

      setAssistantDriven(true);
      clearSelection();
      reportInteraction('dashboard_prompt_planning_started', {
        source: 'empty_dashboard',
        templateKind: template?.kind,
        // What the templates panel offered, to read template use against each account's own templates.
        customTemplateCount: templates.counts?.custom,
        grafanaTemplateCount: templates.counts?.grafana,
      });
    },
    [template, templates.counts, clearSelection]
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
      <div className={cx(styles.content, templates.isOpen && !assistantDriven && styles.waitForPrompt)}>
        <div className={styles.top}>
          <div className={styles.heading}>
            <Icon name="apps" size="xxl" className={styles.appsIcon} />
            <h2 className={styles.title}>
              <Trans i18nKey="dashboard.empty.build-assistant">Build your dashboard with Assistant</Trans>
            </h2>
          </div>
          <div className={styles.prompt}>
            <DashboardLandingPrompt
              onSubmit={onSubmitPrompt}
              placeholder={
                template
                  ? // Short enough for one line at phone width; the pill already names the template.
                    t('dashboard.empty.assistant-placeholder-template', 'Add changes, or send as is')
                  : undefined
              }
              hostContextItems={template ? [template.contextItem] : []}
              onHostContextItemRemove={templates.removePill}
              renderHostActions={showTemplates ? templates.renderToggle : undefined}
            />
          </div>
        </div>

        {showTemplates && (
          // Mounted at once so the templates load alongside the prompt; closed, the panel takes no room.
          <LandingTemplates
            {...templates.panelProps}
            className={styles.templates}
            testDataSource={testDataSource}
            showGrafanaTemplates={showGrafanaTemplates}
            showCustomTemplates={showCustomTemplates}
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

const reveal = keyframes({ to: { visibility: 'visible' } });

function getStyles(theme: GrafanaTheme2) {
  const prompt = css({
    position: 'relative',
    zIndex: 1,
    width: '100%',
    // The plugin's text box is shorter while its code loads; the floor keeps what is below from moving as it does.
    minHeight: PROMPT_HEIGHT,
  });
  // The panel starts behind the prompt, so the two read as one control.
  const templates = css({
    marginTop: `calc(-1 * (${theme.spacing(4)} + ${PROMPT_OVERLAP}px))`,
    // The search row's top inset.
    paddingTop: `calc(${PROMPT_OVERLAP}px + ${theme.spacing(0.5)})`,
  });

  return {
    root: css({
      display: 'flex',
      justifyContent: 'center',
      width: '100%',
    }),
    // As wide as the dashboard area lets it, with or without templates; the empty-state wrapper sets the cap and the
    // top inset. Its top stays put, so opening the panel only moves what is below it.
    content: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(4),
      width: '100%',
      padding: theme.spacing(3, 4),
      [theme.breakpoints.down('sm')]: {
        // On a phone the scroll area already insets the page, so the prompt and templates take the full width.
        paddingLeft: 0,
        paddingRight: 0,
        paddingBottom: theme.spacing(6),
      },
    }),
    // With the panel open, the block waits out of sight for the prompt's text box, so the panel never shows beside the
    // prompt's own loader, which stays in view. After 1.5 seconds the rest shows anyway, in case the plugin never gets
    // there, and the panel keeps its room out of sight until the prompt does.
    // Where `:has` is missing, nothing waits.
    waitForPrompt: css({
      '@supports selector(:has(a))': {
        [`&:not(:has(.${prompt} :is([role="textbox"], textarea)))`]: {
          visibility: 'hidden',
          // A switch, not motion, so it holds whatever the person's motion setting.
          [theme.transitions.handleMotion('no-preference', 'reduce')]: {
            animation: `${reveal} 0s 1.5s forwards`,
          },
          [`.${prompt}`]: {
            visibility: 'visible',
          },
          [`.${templates}`]: {
            visibility: 'hidden',
          },
        },
      },
    }),
    top: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(3),
    }),
    // The icon belongs to the heading, closer to it than the heading is to the prompt.
    heading: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(1),
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
      textWrap: 'balance',
    }),
    prompt,
    templates,
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
