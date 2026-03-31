import { css, cx, keyframes } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import useMeasure from 'react-use/lib/useMeasure';

import { AppEvents, CoreApp, GrafanaTheme2, PanelPlugin, PanelProps } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, getDataSourceSrv, locationService } from '@grafana/runtime';
import { SceneDataTransformer, SceneQueryRunner, sceneGraph, sceneUtils } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
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

import { NEW_PANEL_TITLE } from '../../dashboard/utils/dashboard';
import { applyQueryToPanel, getVizSuggestionForQuery } from '../utils/getVizSuggestionForQuery';
import { DashboardInteractions } from '../utils/interactions';
import {
  BUTTON_ANIM_DURATION_MS,
  BUTTON_STAGGER_INTERVAL_MS,
  EXIT_DURATION_MS,
  EXIT_EASING,
  TEXT_EXIT_DELAY_MS,
  VIEW_PHASE,
  buttonFrames,
  gearFrames,
  textFrames,
  useViewPhase,
} from '../utils/unconfiguredPanelUtils';
import { findVizPanelByKey, getQueryRunnerFor, getVizPanelKeyForPanelId } from '../utils/utils';

import { DashboardScene } from './DashboardScene';

export const UNCONFIGURED_PANEL_PLUGIN_ID = '__unconfigured-panel';
const UnconfiguredPanel = new PanelPlugin(UnconfiguredPanelComp);

function hasSavedQueryReadPermissions(): boolean {
  return config.featureToggles.savedQueriesRBAC
    ? contextSrv.hasPermission(AccessControlAction.QueriesRead)
    : contextSrv.isSignedIn;
}

export function UnconfiguredPanelComp(props: PanelProps) {
  // if (config.featureToggles.newUnconfiguredPanel) {
  return <NewUnconfiguredPanelComp {...props} />;
  // }
  // return <LegacyUnconfiguredPanelComp {...props} />;
}

function NewUnconfiguredPanelComp(props: PanelProps) {
  const panelContext = usePanelContext();
  const styles = useStyles2(getStyles);
  const { openDrawer, queryLibraryEnabled = false } = useQueryLibraryContext();

  const dashboard = window.__grafanaSceneContext;
  const panelKey = getVizPanelKeyForPanelId(props.id);
  const isEditing = dashboard instanceof DashboardScene ? dashboard.state.isEditing : false;

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
      options: { context: 'dashboard' },
    });
  };

  const onUseLibraryPanel = () => {
    if (!dashboard || !(dashboard instanceof DashboardScene)) {
      throw new Error('DashboardScene not found');
    }

    const panel = findVizPanelByKey(dashboard, panelKey);
    if (!panel) {
      throw new Error('Panel not found');
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

  const isQuietVisible = phase !== VIEW_PHASE.Active;
  const isButtonsVisible = phase !== VIEW_PHASE.QuietInitial && phase !== VIEW_PHASE.Quiet;

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

  if (queryLibraryEnabled && hasSavedQueryReadPermissions()) {
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
                phase === VIEW_PHASE.TransitioningToQuiet && styles.gearEntering,
                phase === VIEW_PHASE.TransitioningToActive && styles.gearExiting
              )}
            >
              <Icon name="cog" size="md" />
            </div>
            <span
              className={cx(
                phase === VIEW_PHASE.TransitioningToQuiet && styles.textEntering,
                phase === VIEW_PHASE.TransitioningToActive && styles.textExiting
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
                  phase === VIEW_PHASE.TransitioningToActive && styles.buttonEntering,
                  phase === VIEW_PHASE.TransitioningToQuiet && styles.buttonExiting
                )}
                style={
                  phase === VIEW_PHASE.TransitioningToActive || phase === VIEW_PHASE.TransitioningToQuiet
                    ? { animationDelay: `${(i + 1) * BUTTON_STAGGER_INTERVAL_MS}ms` }
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
        <EmptyState
          variant="call-to-action"
          message={t('dashboard.new-panel.missing-config', 'Missing panel configuration')}
          hideImage
        />
      )}
    </div>
  );
}

function LegacyUnconfiguredPanelComp(props: PanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelContext = usePanelContext();
  const styles = useStyles2(getStyles);
  const { openDrawer: openQueryLibraryDrawer, queryLibraryEnabled } = useQueryLibraryContext();

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

  const dashboard = window.__grafanaSceneContext;
  const panel =
    dashboard instanceof DashboardScene ? findVizPanelByKey(dashboard, getVizPanelKeyForPanelId(props.id)) : null;

  const onUseLibraryPanel = () => {
    if (!dashboard || !(dashboard instanceof DashboardScene)) {
      throw new Error('DashboardScene not found');
    }

    if (!panel) {
      throw new Error('Panel not found');
    }

    dashboard.onShowAddLibraryPanelDrawer(panel.getRef());
  };

  const onUseSavedQuery = useCallback(async () => {
    if (!queryLibraryEnabled) {
      return;
    }

    if (!dashboard || !(dashboard instanceof DashboardScene) || !panel) {
      return;
    }

    openQueryLibraryDrawer({
      onSelectQuery: async (query: DataQuery) => {
        try {
          let queryRunner = getQueryRunnerFor(panel);

          if (!queryRunner && !panel.state.$data) {
            const defaultDatasource = getDataSourceSrv().getInstanceSettings(null)?.name;
            panel.setState({
              $data: new SceneDataTransformer({
                $data: new SceneQueryRunner({
                  datasource: {
                    uid: defaultDatasource,
                  },
                  queries: [],
                }),
                transformations: [],
              }),
            });
            queryRunner = getQueryRunnerFor(panel);
          }

          if (!queryRunner) {
            console.error('Failed to get or create query runner for panel');
            return;
          }

          const enrichedQuery = query.datasource
            ? query
            : {
                ...query,
                datasource: queryRunner.state.datasource || { uid: config.defaultDatasource },
              };

          queryRunner.setState({ queries: [enrichedQuery] });

          panel.changePluginType('table');

          if (enrichedQuery.datasource?.uid) {
            const dsSettings = await getDataSourceSrv().get({ uid: enrichedQuery.datasource.uid });
            queryRunner.setState({ datasource: { uid: dsSettings.uid, type: dsSettings.type } });
          }

          locationService.partial({ editPanel: props.id });

          setTimeout(() => {
            queryRunner.runQueries();
          }, 0);
        } catch (error) {
          console.error('Failed to set query from library:', error);
        }
      },
      options: {
        context: CoreApp.Dashboard,
      },
    });
  }, [dashboard, panel, props.id, openQueryLibraryDrawer, queryLibraryEnabled]);

  useEffect(() => {
    if (!panel || !config.featureToggles.newVizSuggestions) {
      return;
    }

    if (panelContext.app === CoreApp.PanelEditor) {
      panel.setState({ title: '' });
    } else if (!panel.state.title) {
      panel.setState({ title: NEW_PANEL_TITLE });
    }
  }, [panel, panelContext.app]);

  const MenuActions = () => (
    <Menu>
      <Menu.Item
        icon="pen"
        label={t('dashboard.new-panel.menu-open-panel-editor', 'Configure')}
        onClick={onConfigure}
      ></Menu.Item>
      {queryLibraryEnabled && hasSavedQueryReadPermissions() && (
        <Menu.Item
          icon="book-open"
          label={t('dashboard.new-panel.menu-use-saved-query', 'Use saved query')}
          onClick={onUseSavedQuery}
        ></Menu.Item>
      )}
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

  if (!dashboard || !(dashboard instanceof DashboardScene)) {
    return null;
  }

  const { isEditing } = dashboard.state;

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
  const anim = (kf: ReturnType<typeof keyframes>, duration: number, easing: string): string =>
    `${kf} ${duration}ms ${easing} both`;

  return {
    root: css({
      containerType: 'size',
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
        animation: anim(gearFrames.enter, EXIT_DURATION_MS, EXIT_EASING),
      },
    }),
    gearExiting: css({
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: anim(gearFrames.exit, EXIT_DURATION_MS, EXIT_EASING),
      },
    }),
    textEntering: css({
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: anim(textFrames.enter, EXIT_DURATION_MS, EXIT_EASING),
      },
    }),
    textExiting: css({
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: anim(textFrames.exit, EXIT_DURATION_MS, EXIT_EASING),
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
      [`${theme.breakpoints.container.up('md')} and (max-height: 149px)`]: {
        flexDirection: 'row',
        alignItems: 'center',
      },
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
        animation: anim(buttonFrames.enter, BUTTON_ANIM_DURATION_MS, 'ease-out'),
      },
    }),
    buttonExiting: css({
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: anim(buttonFrames.exit, BUTTON_ANIM_DURATION_MS, 'ease-out'),
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
