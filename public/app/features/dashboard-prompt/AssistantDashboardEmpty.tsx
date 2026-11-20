import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import { type ChatContextItem, checkLimits } from '@grafana/assistant';
import { AppEvents, type GrafanaTheme2, store } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Icon, Spinner, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { useHoldFloatingExtensionSidebar } from 'app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider';
import { contextSrv } from 'app/core/services/context_srv';
import { useTemplateDashboardsAvailability } from 'app/features/dashboard/dashgrid/DashboardLibrary/hooks/useTemplateDashboardsAvailability';
import { type TemplateSelection } from 'app/features/dashboard/dashgrid/DashboardLibrary/types';
import { OPEN_TEMPLATE_PROMPT } from 'app/features/dashboard/dashgrid/DashboardLibrary/utils/assistantHelpers';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { DashboardLandingPrompt, PROMPT_HEIGHT } from './DashboardLandingPrompt';
import { LandingTemplates, LandingTemplatesToggle, type TemplateCounts } from './LandingTemplates';
import { getPromptDatasources } from './datasources';
import { openTemplateInAssistant, startPlanningInAssistant } from './handoff';

interface Props {
  dashboard: DashboardScene;
}

/** How far the template panel starts behind the prompt. */
const PROMPT_OVERLAP = 24;

/**
 * How the free space around the landing splits, above to below. Centered, a tall screen leaves the block low under
 * the dashboard's toolbar and the edit pane's controls, which sit at the top; one part above to two below lifts it.
 */
const FREE_SPACE_ABOVE = 1;
const FREE_SPACE_BELOW = 2;

/** How the person last left the templates panel, open or closed, kept for their next visit. */
const TEMPLATES_OPEN_KEY = 'grafana.dashboard.landing.templatesOpen';

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
    return t('dashboard.empty.assistant-unreachable', 'Could not reach the Assistant. Try sending again.');
  }
  return undefined;
}

/**
 * Sizes the landing to at least the whole area its dashboard scrolls in, from the top edge to the bottom, so its
 * content sits in that area with the free space split around it (`FREE_SPACE_ABOVE`, `FREE_SPACE_BELOW`). The
 * dashboard body grows with its content, so no CSS height chain reaches this far down, and the empty-state
 * wrapper's top padding is pulled back into the area (`pullUp`).
 */
function useFitToScrollArea() {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ height: number; pullUp: number }>();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const update = () => {
      const parent = element.parentElement;
      let scrollArea = parent;
      while (scrollArea && !/(auto|scroll)/.test(getComputedStyle(scrollArea).overflowY)) {
        scrollArea = scrollArea.parentElement;
      }
      if (!parent || !scrollArea) {
        return;
      }
      const areaStyle = getComputedStyle(scrollArea);
      const areaRect = scrollArea.getBoundingClientRect();
      const areaTop = areaRect.top + parseFloat(areaStyle.paddingTop || '0');
      // On narrow screens the page scrolls instead and the dashboard area grows with its content, so the
      // viewport's bottom edge is the limit there.
      const areaBottom = Math.min(areaRect.bottom, window.innerHeight) - parseFloat(areaStyle.paddingBottom || '0');
      // Where the landing starts without the pull-up: the parent's content edge, which its own margin never moves.
      const naturalTop = parent.getBoundingClientRect().top + parseFloat(getComputedStyle(parent).paddingTop || '0');
      setFit({
        height: Math.max(0, Math.floor(areaBottom - areaTop)),
        pullUp: Math.max(0, Math.floor(naturalTop - areaTop)),
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return { ref, fit };
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
  const { ref: fitRef, fit } = useFitToScrollArea();
  const [templateCounts, setTemplateCounts] = useState<TemplateCounts>();
  // The block is shaped by the first counts the lists report (within LOAD_WAIT_MS), so it shows once and never moves:
  // whether there is a toggle, and whether the panel starts open, only when the account has templates of its own. A
  // list that reports later does not change it. Until then the block waits out of sight.
  const [firstCounts, setFirstCounts] = useState<TemplateCounts>();
  const onTemplatesCount = useCallback((counts: TemplateCounts) => {
    setTemplateCounts(counts);
    setFirstCounts((current) => current ?? counts);
  }, []);
  const ready = !showTemplates || firstCounts !== undefined;
  const firstCustom = firstCounts?.custom ?? 0;
  const withTemplates = showTemplates && firstCustom + (firstCounts?.grafana ?? 0) > 0;
  const templatesId = useId();
  // The person's last toggle wins over the default.
  const [templatesOpenedByUser, setTemplatesOpenedByUser] = useState(() =>
    store.exists(TEMPLATES_OPEN_KEY) ? store.getBool(TEMPLATES_OPEN_KEY, false) : undefined
  );
  const templatesOpen = templatesOpenedByUser ?? firstCustom > 0;
  // Opening or closing the templates keeps the content's height, so the block stays put under the person's pointer
  // instead of moving with the free space; the actions move and the room goes below them. A new fit places it again.
  const contentRef = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState<{ fit: typeof fit; height: number }>();
  const heldHeight = held && held.fit === fit ? held.height : undefined;
  const onTemplatesToggle = useCallback(() => {
    const height = contentRef.current?.getBoundingClientRect().height;
    if (height !== undefined) {
      setHeld({ fit, height });
    }
    store.set(TEMPLATES_OPEN_KEY, !templatesOpen);
    setTemplatesOpenedByUser(!templatesOpen);
  }, [fit, templatesOpen]);
  const renderTemplatesToggle = useCallback(
    () => <LandingTemplatesToggle isOpen={templatesOpen} onToggle={onTemplatesToggle} controls={templatesId} />,
    [templatesOpen, onTemplatesToggle, templatesId]
  );
  // The picked template travels to the Assistant as a context pill in the prompt.
  const [template, setTemplate] = useState<TemplateSelection>();

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
      setTemplate(undefined);
      reportInteraction('dashboard_prompt_planning_started', {
        source: 'empty_dashboard',
        templateKind: template?.kind,
        // What the templates panel offered, to read template use against each account's own templates.
        customTemplateCount: templateCounts?.custom,
        grafanaTemplateCount: templateCounts?.grafana,
      });
    },
    [template, templateCounts]
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
    <div
      ref={fitRef}
      className={cx(styles.root, fit && styles.rootFit)}
      // A minimum, not a height: a screen too short for the content scrolls the page instead of cutting it off.
      style={fit ? { minHeight: fit.height, marginTop: -fit.pullUp } : undefined}
    >
      <div
        ref={contentRef}
        className={cx(styles.content, !ready && styles.contentWaiting)}
        style={heldHeight ? { minHeight: heldHeight } : undefined}
        aria-busy={!ready || undefined}
      >
        {!ready && (
          <div className={styles.waiting}>
            <Spinner size="xl" />
          </div>
        )}
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
              onHostContextItemRemove={onTemplatePillRemove}
              renderHostActions={withTemplates ? renderTemplatesToggle : undefined}
            />
          </div>
        </div>

        {showTemplates && (
          // Mounted at once so the templates load alongside the prompt, out of the layout until there are some to show.
          <LandingTemplates
            id={templatesId}
            isOpen={withTemplates && templatesOpen}
            onTemplatesCount={onTemplatesCount}
            className={styles.templates}
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
    // Fitted to the dashboard's free space: the content keeps its height and spacers above and below share the rest.
    // They only grow, so on a screen too short for the content it starts at the top.
    rootFit: css({
      flexDirection: 'column',
      height: 'auto',
      '&::before': {
        content: '""',
        flex: `${FREE_SPACE_ABOVE} 0 0`,
      },
      '&::after': {
        content: '""',
        flex: `${FREE_SPACE_BELOW} 0 0`,
      },
    }),
    // As wide as the dashboard area lets it, with or without templates; the empty-state wrapper sets the cap.
    content: css({
      position: 'relative',
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
    // Laid out but out of sight, so it shows in place once it is ready.
    contentWaiting: css({
      visibility: 'hidden',
    }),
    waiting: css({
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      visibility: 'visible',
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
    prompt: css({
      position: 'relative',
      zIndex: 1,
      width: '100%',
      // The plugin's text box is shorter while its code loads; the floor keeps the block from moving as it does.
      minHeight: PROMPT_HEIGHT,
    }),
    // The panel starts behind the prompt, so the two read as one control.
    templates: css({
      marginTop: `calc(-1 * (${theme.spacing(4)} + ${PROMPT_OVERLAP}px))`,
      // The search row's top inset.
      paddingTop: `calc(${PROMPT_OVERLAP}px + ${theme.spacing(0.5)})`,
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
      lineHeight: theme.typography.bodySmall.lineHeight,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }),
    addButton: css({
      width: '100%',
      justifyContent: 'center',
    }),
  };
}
