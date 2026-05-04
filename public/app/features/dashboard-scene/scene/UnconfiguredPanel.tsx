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
  Menu,
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

import { applyQueryToPanel, getVizSuggestionForQuery } from '../utils/getVizSuggestionForQuery';
import { DashboardInteractions } from '../utils/interactions';
import {
  BUTTON_ANIM_DURATION_MS,
  BUTTON_STAGGER_INTERVAL_MS,
  ENTER_DELAY_MS,
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
      options: { context: 'unconfigured-panel' },
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
            {buttons.map((button, i) => (
              <div
                key={button.key}
                className={cx(
                  styles.buttonWrapper,
                  phase === ViewPhase.TransitioningToActive && styles.buttonEntering,
                  phase === ViewPhase.TransitioningToQuiet && styles.buttonExiting
                )}
                style={
                  phase === ViewPhase.TransitioningToActive
                    ? { animationDelay: `${ENTER_DELAY_MS + i * BUTTON_STAGGER_INTERVAL_MS}ms` }
                    : phase === ViewPhase.TransitioningToQuiet
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
        maskImage: `url(${emptyPanelSvg})`,
        maskSize: '100% auto',
        maskPosition: 'bottom',
        maskRepeat: 'no-repeat',
        backgroundColor: theme.colors.text.primary,
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
        animationDelay: `${ENTER_DELAY_MS}ms`,
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
        animationDelay: `${ENTER_DELAY_MS}ms`,
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
  };
}
