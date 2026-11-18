import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { type ChatContextItem } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Icon, useStyles2 } from '@grafana/ui';
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

/** How far the template panel starts behind the prompt. */
const PROMPT_OVERLAP = 24;

/** Below this the page scrolls instead of squeezing the template grid to nothing. */
const MIN_HEIGHT_WITH_TEMPLATES = 360;

/**
 * Sizes the landing to the whole area its dashboard scrolls in, from the top edge to the bottom, so the content
 * can be centered in it, the template grid scrolls inside its panel, and the "build it yourself" actions under it
 * stay in view. The dashboard body grows with its content, so no CSS height chain reaches this far down, and the
 * empty-state wrapper's top padding is pulled back into the area (`pullUp`).
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
        height: Math.max(MIN_HEIGHT_WITH_TEMPLATES, Math.floor(areaBottom - areaTop)),
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
  const { ref: fitRef, fit } = useFitToScrollArea(showTemplates);
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
    <div ref={fitRef} className={styles.root} style={fit ? { height: fit.height, marginTop: -fit.pullUp } : undefined}>
      <div className={cx(styles.content, showTemplates && styles.contentWithTemplates)}>
        <div className={styles.top}>
          <Icon name="apps" size="xxl" className={styles.appsIcon} />
          <h2 className={styles.title}>
            <Trans i18nKey="dashboard.empty.build-assistant">Build your dashboard with Assistant</Trans>
          </h2>
          <div className={styles.prompt}>
            <DashboardLandingPrompt
              onSubmit={onSubmitPrompt}
              placeholder={
                template
                  ? // Short enough for one line at phone width; the pill already names the template.
                    t('dashboard.empty.assistant-placeholder-template', 'Add changes, or send as is')
                  : undefined
              }
              hostContextItems={hostContextItems}
              onHostContextItemRemove={onTemplatePillRemove}
            />
          </div>
          {showTemplates && (
            <LandingTemplates
              className={styles.templates}
              testDataSource={testDataSource}
              showGrafanaTemplates={showGrafanaTemplates}
              showCustomTemplates={showCustomTemplates}
              onSelectTemplate={onSelectTemplate}
              selectedTemplateId={template?.id}
            />
          )}
        </div>

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
    // Room for the template grid's columns under the prompt, and a fixed height for the grid to scroll in.
    // Centered in the dashboard's free space; a long template grid takes what is left and scrolls inside its
    // panel. The extra room below keeps "Add visualization" well clear of the bottom edge.
    contentWithTemplates: css({
      maxWidth: 1040,
      height: '100%',
      justifyContent: 'center',
      paddingTop: theme.spacing(3),
      paddingBottom: theme.spacing(8),
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
      minHeight: 0,
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
      position: 'relative',
      zIndex: 1,
      width: '100%',
    }),
    // The panel starts behind the prompt, so the two read as one control.
    templates: css({
      alignSelf: 'stretch',
      marginTop: `calc(-1 * (${theme.spacing(2)} + ${PROMPT_OVERLAP}px))`,
      // The header's top inset; the closed panel repeats it at the bottom (LandingTemplates `panelClosed`).
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
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }),
    addButton: css({
      width: '100%',
      justifyContent: 'center',
    }),
  };
}
