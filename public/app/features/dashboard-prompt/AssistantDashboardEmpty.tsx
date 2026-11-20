import { css, cx } from '@emotion/css';
import { type RefObject, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

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
import { type TemplateSelection } from 'app/features/dashboard/dashgrid/DashboardLibrary/types';
import { OPEN_TEMPLATE_PROMPT } from 'app/features/dashboard/dashgrid/DashboardLibrary/utils/assistantHelpers';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { DashboardLandingPrompt } from './DashboardLandingPrompt';
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
 * True once the prompt shows its text box. The prompt is a plugin component that loads its own code after the
 * page, behind its own Suspense, so its text box rendering is the only signal the host gets.
 */
function useHasTextbox(ref: RefObject<HTMLElement | null>) {
  const [hasTextbox, setHasTextbox] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const check = () => Boolean(element.querySelector('[role="textbox"], textarea'));
    if (check()) {
      setHasTextbox(true);
      return;
    }
    const observer = new MutationObserver(() => {
      if (check()) {
        observer.disconnect();
        setHasTextbox(true);
      }
    });
    observer.observe(element, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ref]);

  return hasTextbox;
}

/**
 * Sizes the landing to at least the whole area its dashboard scrolls in, from the top edge to the bottom, so its
 * content sits in that area with the free space split around it (`FREE_SPACE_ABOVE`, `FREE_SPACE_BELOW`). The
 * dashboard body grows with its content, so no CSS height chain reaches this far down, and the empty-state
 * wrapper's top padding is pulled back into the area (`pullUp`).
 */
function useFitToScrollArea(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ height: number; pullUp: number }>();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element) {
      setFit(undefined);
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
  }, [enabled]);

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
  const promptRef = useRef<HTMLDivElement>(null);
  const promptReady = useHasTextbox(promptRef);
  const [templateCounts, setTemplateCounts] = useState<TemplateCounts>();
  // The page keeps its plain layout until there are templates to offer: while the prompt and the lists load, and for
  // good when the lists have none. Then a toggle next to the prompt's + button opens the panel under the prompt.
  const withTemplates =
    showTemplates && promptReady && (templateCounts?.custom ?? 0) + (templateCounts?.grafana ?? 0) > 0;
  const { ref: fitRef, fit } = useFitToScrollArea(withTemplates);
  const templatesId = useId();
  const [templatesOpen, setTemplatesOpen] = useState(true);
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
    setTemplatesOpen(!templatesOpen);
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
        className={cx(styles.content, withTemplates && styles.contentWithTemplates)}
        style={heldHeight ? { minHeight: heldHeight } : undefined}
      >
        <div className={cx(styles.top, withTemplates && styles.topWithTemplates)}>
          <div className={cx(styles.heading, withTemplates && styles.headingWithTemplates)}>
            <Icon name="apps" size="xxl" className={styles.appsIcon} />
            <h2 className={styles.title}>
              <Trans i18nKey="dashboard.empty.build-assistant">Build your dashboard with Assistant</Trans>
            </h2>
          </div>
          <div ref={promptRef} className={styles.prompt}>
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
            onTemplatesCount={setTemplateCounts}
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
    content: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(4),
      width: '100%',
      maxWidth: 660,
      padding: theme.spacing(6, 4),
    }),
    contentWithTemplates: css({
      // Wider than the prompt alone, for the grid's columns; the empty-state wrapper sets the actual cap.
      maxWidth: 'none',
      paddingTop: theme.spacing(3),
      paddingBottom: theme.spacing(3),
      [theme.breakpoints.down('sm')]: {
        // On a phone the scroll area already insets the page, so the prompt and templates take the full width.
        paddingLeft: 0,
        paddingRight: 0,
        paddingBottom: theme.spacing(6),
      },
    }),
    top: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(2),
    }),
    heading: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(2),
    }),
    // With the templates, the icon belongs to the heading, closer to it than the heading is to the prompt.
    topWithTemplates: css({
      gap: theme.spacing(3),
    }),
    headingWithTemplates: css({
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
