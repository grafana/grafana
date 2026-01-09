import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { CoreApp, GrafanaTheme2, PanelPlugin, PanelProps } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, getDataSourceSrv, locationService } from '@grafana/runtime';
import { SceneDataTransformer, SceneQueryRunner, sceneUtils } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import {
  Box,
  Button,
  ButtonGroup,
  Dropdown,
  EmptyState,
  Icon,
  Menu,
  Stack,
  Text,
  usePanelContext,
  useStyles2,
} from '@grafana/ui';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { NEW_PANEL_TITLE } from '../../dashboard/utils/dashboard';
import { DashboardInteractions } from '../utils/interactions';
import { findVizPanelByKey, getVizPanelKeyForPanelId, getQueryRunnerFor } from '../utils/utils';

import { DashboardScene } from './DashboardScene';

export const UNCONFIGURED_PANEL_PLUGIN_ID = '__unconfigured-panel';
const UnconfiguredPanel = new PanelPlugin(UnconfiguredPanelComp);

function UnconfiguredPanelComp(props: PanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelContext = usePanelContext();
  const styles = useStyles2(getStyles);
  const { openDrawer: openQueryLibraryDrawer, queryLibraryEnabled } = useQueryLibraryContext();

  const onMenuClick = useCallback((isOpen: boolean) => {
    setIsOpen(isOpen);
  }, []);

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

          // If panel doesn't have a query runner yet, create one
          if (!queryRunner && !panel.state.$data) {
            const defaultDatasource = config.defaultDatasource;
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

          // Set the query in the panel
          queryRunner.setState({ queries: [enrichedQuery] });

          // TODO: Update this to utilize viz suggestions
          panel.changePluginType('table');

          // Update datasource if needed
          if (enrichedQuery.datasource?.uid) {
            const dsSettings = await getDataSourceSrv().get({ uid: enrichedQuery.datasource.uid });
            queryRunner.setState({ datasource: { uid: dsSettings.uid, type: dsSettings.type } });
          }

          locationService.partial({ editPanel: props.id });

          // This is needed to ensure the query runner is initialized before running queries
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
      {queryLibraryEnabled && (
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
  return {
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
