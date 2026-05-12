import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import useMeasure from 'react-use/lib/useMeasure';

import { AppEvents, CoreApp, type GrafanaTheme2, PanelPlugin, type PanelProps } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { sceneGraph, sceneUtils } from '@grafana/scenes';
import {
  Box,
  Button,
  type ButtonVariant,
  ButtonGroup,
  Dropdown,
  EmptyState,
  Icon,
  type IconName,
  Input,
  Menu,
  Modal,
  Spinner,
  Stack,
  Text,
  useElementSelection,
  usePanelContext,
  useStyles2,
} from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { contextSrv } from 'app/core/services/context_srv';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { AccessControlAction } from 'app/types/accessControl';
import emptyPanelSvg from 'img/dashboards/empty-panel.svg';

import { MockViz } from '../../sql-prototype/dashboard/MockViz';
import { DEFAULT_SQL } from '../../sql-prototype/editor/SqlEditor';
import { askAiStream } from '../../sql-prototype/mocks/mockAi';
import { applyQueryToPanel, getVizSuggestionForQuery } from '../utils/getVizSuggestionForQuery';
import { DashboardInteractions } from '../utils/interactions';
import {
  BUTTON_ANIM_DURATION_MS,
  BUTTON_STAGGER_INTERVAL_MS,
  EXIT_DURATION_MS,
  EXIT_EASING,
  TEXT_EXIT_DELAY_MS,
  ViewPhase,
  buttonFrames,
  gearFrames,
  textFrames,
  useViewPhase,
} from '../utils/unconfiguredPanelUtils';
import { findVizPanelByKey, getVizPanelKeyForPanelId } from '../utils/utils';

import { DashboardScene } from './DashboardScene';

export const UNCONFIGURED_PANEL_PLUGIN_ID = '__unconfigured-panel';

type VizType = 'timeseries' | 'barchart' | 'stat' | 'bargauge';

interface AiResult {
  prompt: string;
  sql: string;
  vizType: VizType;
}

const PROMQL_FOR_VIZ: Record<VizType, string> = {
  timeseries: `histogram_quantile(0.95,
  sum by (le, path) (
    rate(http_server_requests_seconds_bucket[5m])
  )
)`,
  barchart: `sum by (path, method) (
  rate(http_server_requests_seconds_count{
    status=~"5.."
  }[5m])
)
/
sum by (path, method) (
  rate(http_server_requests_seconds_count[5m])
)`,
  bargauge: `topk(5,
  sum by (path) (
    rate(http_server_requests_seconds_count[5m])
  )
)`,
  stat: `histogram_quantile(0.50,
  sum by (le) (
    rate(http_server_requests_seconds_bucket[5m])
  )
)`,
};
const UnconfiguredPanel = new PanelPlugin(UnconfiguredPanelComp);

function hasSavedQueryReadPermissions(): boolean {
  return config.featureToggles.savedQueriesRBAC
    ? contextSrv.hasPermission(AccessControlAction.QueriesRead)
    : contextSrv.isSignedIn;
}

// Delegates to NewUnconfiguredPanelComp (animated hover-reveal buttons) when the
// newUnconfiguredPanel feature toggle is on, otherwise falls back to LegacyUnconfiguredPanelComp
// (ButtonGroup + dropdown). Two separate components avoid React hooks-in-conditionals violations.
export function UnconfiguredPanelComp(props: PanelProps) {
  if (config.featureToggles.newUnconfiguredPanel) {
    return <NewUnconfiguredPanelComp {...props} />;
  }
  return <LegacyUnconfiguredPanelComp {...props} />;
}

// PanelPlugin components receive PanelProps and have no SceneObject parent reference,
// so window.__grafanaSceneContext is the only available mechanism to reach the DashboardScene.
// We subscribe to state changes via subscribeToState so isEditing triggers re-renders.
function useUnconfiguredPanelDashboard(): { dashboard: DashboardScene | null; isEditing: boolean } {
  const ctx = window.__grafanaSceneContext;
  const dashboard = ctx instanceof DashboardScene ? ctx : null;
  const [isEditing, setIsEditing] = useState(() => dashboard?.state.isEditing ?? false);

  useEffect(() => {
    if (!dashboard) {
      return;
    }
    const sub = dashboard.subscribeToState((state) => setIsEditing(state.isEditing ?? false));
    return () => sub.unsubscribe();
  }, [dashboard]);

  return { dashboard, isEditing };
}

function NewUnconfiguredPanelComp(props: PanelProps) {
  const panelContext = usePanelContext();
  const styles = useStyles2(getStyles);
  const { openDrawer, queryLibraryEnabled = false } = useQueryLibraryContext();

  const { dashboard, isEditing } = useUnconfiguredPanelDashboard();
  const panelKey = getVizPanelKeyForPanelId(props.id);

  const [measureRef, { width, height }] = useMeasure<HTMLDivElement>();
  const isCompact = width < 175 && height < 150;

  const { isSelected } = useElementSelection(panelKey);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isActive = Boolean(isEditing && (isSelected || isHovered || isFocused));

  const [aiInput, setAiInput] = useState('');
  const [aiPhase, setAiPhase] = useState<'idle' | 'loading' | 'preview'>('idle');
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [aiTab, setAiTab] = useState<'sql' | 'promql'>('sql');

  const handleBlur = (e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsFocused(false);
    }
  };
  const phase = useViewPhase(isActive);

  const onConfigure = () => {
    locationService.partial({ editPanel: props.id });
    DashboardInteractions.panelActionClicked('configure', props.id, 'panel');
  };

  const onUseSavedQuery = () => {
    openDrawer({
      onSelectQuery: async (query, title) => {
        if (!(dashboard instanceof DashboardScene)) {
          return;
        }

        const panel = findVizPanelByKey(dashboard, panelKey);
        if (!panel) {
          return;
        }

        try {
          const timeRange = sceneGraph.getTimeRange(dashboard).state.value;
          const suggestion = await getVizSuggestionForQuery(query, timeRange);
          if (!suggestion) {
            appEvents.emit(AppEvents.alertWarning, [
              t('dashboard.new-panel.saved-query-no-suggestion', 'No visualization found'),
              t(
                'dashboard.new-panel.saved-query-no-suggestion-detail',
                'The query did not return enough data to suggest a visualization type.'
              ),
            ]);
            return;
          }
          await applyQueryToPanel(panel, dashboard, query, suggestion, title);
        } catch {
          appEvents.emit(AppEvents.alertError, [
            t('dashboard.new-panel.saved-query-apply-error', 'Failed to apply saved query'),
            t(
              'dashboard.new-panel.saved-query-apply-error-detail',
              'An error occurred while applying the saved query. Please try again.'
            ),
          ]);
        }
      },
      options: { context: 'dashboard' },
    });
  };

  const onUseLibraryPanel = () => {
    if (!dashboard) {
      return;
    }

    const panel = findVizPanelByKey(dashboard, panelKey);
    if (!panel) {
      return;
    }

    dashboard.onShowAddLibraryPanelDrawer(panel.getRef());
  };

  const handleAiSubmit = async () => {
    if (!aiInput.trim()) {
      return;
    }
    setAiPhase('loading');
    let responseText = '';
    const gen = askAiStream({ kind: 'generate-panel', payload: aiInput.trim() });
    for await (const chunk of gen) {
      responseText += chunk;
    }
    try {
      const parsed: { sql: string; vizType: VizType } = JSON.parse(responseText);
      setAiResult({ prompt: aiInput.trim(), sql: parsed.sql, vizType: parsed.vizType });
    } catch {
      setAiResult({ prompt: aiInput.trim(), sql: DEFAULT_SQL, vizType: 'timeseries' });
    }
    setAiPhase('preview');
  };

  const handleAiApply = () => {
    if (!dashboard || !aiResult) {
      return;
    }
    const panel = findVizPanelByKey(dashboard, panelKey);
    if (!panel || !(dashboard instanceof DashboardScene)) {
      return;
    }
    dashboard.changePanelPlugin(panel, aiResult.vizType, {}, { defaults: {}, overrides: [] });
    dashboard.updatePanelTitle(panel, aiResult.prompt);
    setAiPhase('idle');
  };

  const handleAiOpenWorkbench = () => {
    if (!aiResult) {
      return;
    }
    setAiPhase('idle');
    locationService.push({ pathname: '/dashboard/sql-prototype', state: { initialSql: aiResult.sql } });
  };

  const showEmptyState = config.featureToggles.newVizSuggestions && panelContext.app === CoreApp.PanelEditor;

  if (showEmptyState) {
    return (
      <div className={styles.emptyStateWrapper}>
        <Icon name="chart-line" size="xxxl" className={styles.emptyStateIcon} />
        <Text element="p" textAlignment="center" color="secondary">
          <Trans i18nKey="dashboard.new-panel.empty-state-message">
            Run a query to visualize it here or go to all visualizations to add other panel types
          </Trans>
        </Text>
      </div>
    );
  }

  const isQuietVisible = phase !== ViewPhase.Active;
  const isButtonsVisible = phase !== ViewPhase.QuietInitial && phase !== ViewPhase.Quiet;

  const buttons: Array<{
    key: string;
    icon: IconName;
    label: string;
    onClick: () => void;
    variant?: ButtonVariant;
  }> = [
    {
      key: 'configure',
      icon: 'sliders-v-alt',
      label: t('dashboard.new-panel.configure-visualization', 'Configure visualization'),
      onClick: onConfigure,
    },
    {
      key: 'library-panel',
      icon: 'library-panel',
      label: t('dashboard.new-panel.menu-use-library-panel', 'Use library panel'),
      onClick: onUseLibraryPanel,
      variant: 'secondary',
    },
  ];

  if (queryLibraryEnabled && config.featureToggles.newVizSuggestions && hasSavedQueryReadPermissions()) {
    buttons.splice(1, 0, {
      key: 'saved-query',
      icon: 'book-open',
      label: t('dashboard.new-panel.menu-use-saved-query', 'Use saved query'),
      onClick: onUseSavedQuery,
      variant: 'secondary',
    });
  }

  return (
    <>
    <div
      ref={measureRef}
      className={styles.root}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
    >
      {isEditing ? (
        <>
          <div
            className={cx(styles.quietState, !isQuietVisible && styles.hidden)}
            aria-hidden={!isQuietVisible}
            {...(isQuietVisible && isEditing ? { tabIndex: 0 } : { tabIndex: -1 })}
            aria-label={t('dashboard.new-panel.aria-label', 'Unconfigured panel. Tab to see configuration options.')}
          >
            <div
              className={cx(
                styles.gearIconWrapper,
                phase === ViewPhase.TransitioningToQuiet && styles.gearEntering,
                phase === ViewPhase.TransitioningToActive && styles.gearExiting
              )}
            >
              <Icon name="cog" size="md" />
            </div>
            <span
              className={cx(
                phase === ViewPhase.TransitioningToQuiet && styles.textEntering,
                phase === ViewPhase.TransitioningToActive && styles.textExiting
              )}
            >
              <Text color="secondary">
                <Trans i18nKey="dashboard.new-panel.no-visualization">No visualization configured</Trans>
              </Text>
            </span>
          </div>

          <div
            className={cx(styles.buttonList, isCompact && styles.buttonListCompact, !isButtonsVisible && styles.hidden)}
            aria-hidden={!isButtonsVisible}
            {...(!isButtonsVisible ? { inert: '' } : {})}
          >
            {!isCompact && config.featureToggles.sqlAbstractionPrototype && (
              <>
                <Input
                  prefix={<span className={styles.aiSparkle}>✨</span>}
                  placeholder={t('dashboard.new-panel.ai-prompt-placeholder', 'What do you want to learn?')}
                  value={aiInput}
                  onChange={(e) => setAiInput(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void handleAiSubmit();
                    }
                  }}
                  disabled={aiPhase === 'loading'}
                />
                {aiPhase === 'loading' && (
                  <div className={styles.aiLoadingRow}>
                    <Spinner size="sm" />
                    <Text variant="bodySmall" color="secondary">
                      <Trans i18nKey="dashboard.new-panel.ai-generating">Generating…</Trans>
                    </Text>
                  </div>
                )}
                <div className={styles.aiDivider}>
                  <Text variant="bodySmall" color="disabled">
                    <Trans i18nKey="dashboard.new-panel.ai-or">or</Trans>
                  </Text>
                </div>
              </>
            )}
            {buttons.map((button, i) => (
              <div
                key={button.key}
                className={cx(
                  styles.buttonWrapper,
                  phase === ViewPhase.TransitioningToActive && styles.buttonEntering,
                  phase === ViewPhase.TransitioningToQuiet && styles.buttonExiting
                )}
                style={
                  phase === ViewPhase.TransitioningToActive || phase === ViewPhase.TransitioningToQuiet
                    ? { animationDelay: `${i * BUTTON_STAGGER_INTERVAL_MS}ms` }
                    : undefined
                }
              >
                {isCompact ? (
                  <Button icon={button.icon} variant={button.variant} onClick={button.onClick} tooltip={button.label} />
                ) : (
                  <Button icon={button.icon} variant={button.variant} onClick={button.onClick} fullWidth>
                    {button.label}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.quietState}>
          <div className={styles.gearIconWrapper}>
            <Icon name="cog" size="md" />
          </div>
          <Text color="secondary">
            <Trans i18nKey="dashboard.new-panel.no-visualization">No visualization configured</Trans>
          </Text>
        </div>
      )}
    </div>

    {config.featureToggles.sqlAbstractionPrototype && aiPhase === 'preview' && aiResult && (
      <Modal
        title={
          <div className={styles.aiModalTitle}>
            <span className={styles.aiSparkle}>✨</span>
            <span>{t('dashboard.new-panel.ai-modal-title', 'AI-generated panel')}</span>
          </div>
        }
        ariaLabel={t('dashboard.new-panel.ai-modal-aria-label', 'AI-generated panel')}
        isOpen
        onDismiss={() => setAiPhase('idle')}
        contentClassName={styles.aiModalContent}
      >
        <div className={styles.aiPromptChip}>
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="dashboard.new-panel.ai-your-question">Your question:</Trans>{' '}
          </Text>
          <Text variant="bodySmall" weight="medium">
            &ldquo;{aiResult.prompt}&rdquo;
          </Text>
        </div>

        <div className={styles.aiQueryContainer}>
          <div className={styles.aiTabBar} role="tablist">
            <button
              role="tab"
              aria-selected={aiTab === 'sql'}
              className={cx(styles.aiTab, aiTab === 'sql' && styles.aiTabActive)}
              onClick={() => setAiTab('sql')}
            >
              SQL
            </button>
            <button
              role="tab"
              aria-selected={aiTab === 'promql'}
              className={cx(styles.aiTab, aiTab === 'promql' && styles.aiTabActive)}
              onClick={() => setAiTab('promql')}
            >
              PromQL
            </button>
          </div>
          <pre className={styles.aiCodeBlock}>
            {aiTab === 'sql' ? aiResult.sql : PROMQL_FOR_VIZ[aiResult.vizType]}
          </pre>
        </div>

        <div className={styles.aiChartSection}>
          <Text variant="bodySmall" color="secondary" weight="bold">
            <Trans i18nKey="dashboard.new-panel.ai-suggested-viz">Suggested visualization</Trans>
          </Text>
          <div className={styles.aiChartWrap}>
            <MockViz title={aiResult.prompt} height={200} />
          </div>
        </div>

        <div className={styles.aiActions}>
          <Button variant="primary" icon="plus" onClick={handleAiApply}>
            <Trans i18nKey="dashboard.new-panel.ai-add-to-dashboard">Add to dashboard</Trans>
          </Button>
          <Button variant="secondary" icon="pen" onClick={handleAiOpenWorkbench}>
            <Trans i18nKey="dashboard.new-panel.ai-open-workbench">Open in SQL workbench</Trans>
          </Button>
          <Button variant="secondary" fill="text" onClick={() => setAiPhase('idle')}>
            <Trans i18nKey="dashboard.new-panel.ai-cancel">Cancel</Trans>
          </Button>
        </div>
      </Modal>
    )}
    </>
  );
}

function LegacyUnconfiguredPanelComp(props: PanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelContext = usePanelContext();
  const styles = useStyles2(getStyles);

  const onMenuClick = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        DashboardInteractions.panelActionClicked('configure_dropdown', props.id, 'panel');
      }
      setIsOpen(isOpen);
    },
    [props.id]
  );

  const onConfigure = () => {
    locationService.partial({ editPanel: props.id });
    DashboardInteractions.panelActionClicked('configure', props.id, 'panel');
  };

  const { dashboard, isEditing } = useUnconfiguredPanelDashboard();
  const panel = dashboard ? findVizPanelByKey(dashboard, getVizPanelKeyForPanelId(props.id)) : null;

  const onUseLibraryPanel = () => {
    if (!dashboard) {
      return;
    }

    if (!panel) {
      return;
    }

    dashboard.onShowAddLibraryPanelDrawer(panel.getRef());
  };

  const MenuActions = () => (
    <Menu>
      <Menu.Item
        icon="pen"
        label={t('dashboard.new-panel.menu-open-panel-editor', 'Configure')}
        onClick={onConfigure}
      ></Menu.Item>
      <Menu.Item
        icon="library-panel"
        label={t('dashboard.new-panel.menu-use-library-panel', 'Use library panel')}
        onClick={onUseLibraryPanel}
      ></Menu.Item>
    </Menu>
  );

  const showEmptyState = config.featureToggles.newVizSuggestions && panelContext.app === CoreApp.PanelEditor;

  if (showEmptyState) {
    const defaultContent = (
      <Trans i18nKey="dashboard.new-panel.empty-state-message">
        Run a query to visualize it here or go to all visualizations to add other panel types
      </Trans>
    );

    return (
      <div className={styles.emptyStateWrapper}>
        <Icon name="chart-line" size="xxxl" className={styles.emptyStateIcon} />
        <Text element="p" textAlignment="center" color="secondary">
          {defaultContent}
        </Text>
      </div>
    );
  }

  return (
    <Stack direction={'row'} alignItems={'center'} height={'100%'} justifyContent={'center'}>
      <Box paddingBottom={2}>
        {isEditing ? (
          <ButtonGroup>
            <Button icon="sliders-v-alt" onClick={onConfigure}>
              <Trans i18nKey="dashboard.new-panel.configure-button">Configure</Trans>
            </Button>
            <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={onMenuClick}>
              <Button
                aria-label={t('dashboard.new-panel.configure-button-menu', 'Toggle menu')}
                icon={isOpen ? 'angle-up' : 'angle-down'}
              />
            </Dropdown>
          </ButtonGroup>
        ) : (
          <EmptyState
            variant="call-to-action"
            message={t('dashboard.new-panel.missing-config', 'Missing panel configuration')}
            hideImage
          />
        )}
      </Box>
    </Stack>
  );
}

sceneUtils.registerRuntimePanelPlugin({
  pluginId: UNCONFIGURED_PANEL_PLUGIN_ID,
  plugin: UnconfiguredPanel,
});

function getStyles(theme: GrafanaTheme2) {
  return {
    root: css({
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      '&::before': {
        content: '""',
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${emptyPanelSvg})`,
        backgroundSize: '100% auto',
        backgroundPosition: 'bottom',
        backgroundRepeat: 'no-repeat',
        opacity: 0.08,
        pointerEvents: 'none',
      },
    }),
    hidden: css({
      opacity: 0,
      pointerEvents: 'none',
    }),
    quietState: css({
      position: 'absolute',
      inset: 0,
      margin: 'auto',
      width: 'fit-content',
      height: 'fit-content',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    gearIconWrapper: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: `1px dashed ${theme.colors.text.secondary}`,
      borderRadius: theme.shape.radius.circle,
      padding: theme.spacing(1),
      color: theme.colors.text.secondary,
    }),
    gearEntering: css({
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${gearFrames.enter} ${EXIT_DURATION_MS}ms ${EXIT_EASING} both`,
      },
    }),
    gearExiting: css({
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${gearFrames.exit} ${EXIT_DURATION_MS}ms ${EXIT_EASING} both`,
      },
    }),
    textEntering: css({
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${textFrames.enter} ${EXIT_DURATION_MS}ms ${EXIT_EASING} both`,
      },
    }),
    textExiting: css({
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${textFrames.exit} ${EXIT_DURATION_MS}ms ${EXIT_EASING} both`,
        animationDelay: `${TEXT_EXIT_DELAY_MS}ms`,
      },
    }),
    buttonList: css({
      position: 'absolute',
      inset: 0,
      margin: 'auto',
      width: 'fit-content',
      height: 'fit-content',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: theme.spacing(1),
    }),
    buttonListCompact: css({
      flexDirection: 'row',
      alignItems: 'center',
    }),
    buttonWrapper: css({
      display: 'flex',
    }),
    buttonEntering: css({
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${buttonFrames.enter} ${BUTTON_ANIM_DURATION_MS}ms ease-out both`,
      },
    }),
    buttonExiting: css({
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${buttonFrames.exit} ${BUTTON_ANIM_DURATION_MS}ms ease-out both`,
      },
    }),
    emptyStateWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      textAlign: 'center',
    }),
    emptyStateIcon: css({
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing(2),
    }),
    aiSparkle: css({ fontSize: '16px' }),
    aiLoadingRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    aiDivider: css({
      display: 'flex',
      justifyContent: 'center',
      padding: theme.spacing(0.5, 0),
    }),
    aiModalTitle: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    aiModalContent: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
    aiPromptChip: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.75, 1.25),
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.pill,
      alignSelf: 'flex-start',
      alignItems: 'center',
    }),
    aiQueryContainer: css({
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
    }),
    aiTabBar: css({
      display: 'flex',
      background: theme.colors.background.secondary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    aiTab: css({
      background: 'none',
      border: 'none',
      borderBottom: '2px solid transparent',
      padding: theme.spacing(0.75, 1.5),
      cursor: 'pointer',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontFamily: theme.typography.fontFamily,
      '&:hover': { color: theme.colors.text.primary },
    }),
    aiTabActive: css({
      color: theme.colors.text.primary,
      borderBottomColor: theme.colors.primary.main,
    }),
    aiCodeBlock: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      background: theme.colors.background.canvas,
      padding: theme.spacing(1.5),
      margin: 0,
      whiteSpace: 'pre-wrap',
      color: theme.colors.text.primary,
      height: 220,
      overflowY: 'auto',
    }),
    aiChartSection: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.75),
    }),
    aiChartWrap: css({
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
      background: theme.colors.background.primary,
    }),
    aiActions: css({
      display: 'flex',
      gap: theme.spacing(1),
      paddingTop: theme.spacing(1),
      borderTop: `1px solid ${theme.colors.border.weak}`,
      flexWrap: 'wrap',
    }),
  };
}
