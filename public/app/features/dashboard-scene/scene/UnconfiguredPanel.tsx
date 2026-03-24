import { css } from '@emotion/css';

import { CoreApp, GrafanaTheme2, PanelPlugin, PanelProps } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { sceneGraph, sceneUtils } from '@grafana/scenes';
import { Button, EmptyState, Icon, Text, useElementSelection, usePanelContext, useStyles2 } from '@grafana/ui';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { applyQueryToPanel, getVizSuggestionForQuery } from '../utils/getVizSuggestionForQuery';
import { DashboardInteractions } from '../utils/interactions';
import { findVizPanelByKey, getVizPanelKeyForPanelId } from '../utils/utils';

import { DashboardScene } from './DashboardScene';

export const UNCONFIGURED_PANEL_PLUGIN_ID = '__unconfigured-panel';
const UnconfiguredPanel = new PanelPlugin(UnconfiguredPanelComp);

function UnconfiguredPanelComp(props: PanelProps) {
  const panelContext = usePanelContext();
  const styles = useStyles2(getStyles);
  const { openDrawer, queryLibraryEnabled } = useQueryLibraryContext();

  const onConfigure = () => {
    locationService.partial({ editPanel: props.id });
    DashboardInteractions.panelActionClicked('configure', props.id, 'panel');
  };

  const dashboard = window.__grafanaSceneContext;
  const panel =
    dashboard instanceof DashboardScene ? findVizPanelByKey(dashboard, getVizPanelKeyForPanelId(props.id)) : null;

  const { isSelected } = useElementSelection(panel?.state.key);

  const onUseSavedQuery = () => {
    openDrawer({
      onSelectQuery: async (query, title) => {
        if (!(dashboard instanceof DashboardScene) || !panel) {
          return;
        }
        const timeRange = sceneGraph.getTimeRange(dashboard).state.value;
        const suggestion = await getVizSuggestionForQuery(query, timeRange);
        if (!suggestion) {
          return;
        }
        await applyQueryToPanel(panel, dashboard, query, suggestion, title);
      },
      options: { context: 'dashboard' },
    });
  };

  const onUseLibraryPanel = () => {
    if (!dashboard || !(dashboard instanceof DashboardScene)) {
      throw new Error('DashboardScene not found');
    }

    if (!panel) {
      throw new Error('Panel not found');
    }

    dashboard.onShowAddLibraryPanelDrawer(panel.getRef());
  };

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
    <div className={styles.root} data-selected={isSelected || undefined}>
      {isEditing ? (
        <>
          <div className={styles.quietState}>
            <div className={styles.gearIconWrapper}>
              <Icon name="cog" size="xl" />
            </div>
            <Text color="secondary">
              <Trans i18nKey="dashboard.new-panel.no-visualization">No visualization configured</Trans>
            </Text>
          </div>
          <div className={styles.buttonList}>
            <Button icon="sliders-v-alt" onClick={onConfigure} fullWidth>
              <Trans i18nKey="dashboard.new-panel.configure-visualization">Configure visualization</Trans>
            </Button>
            {queryLibraryEnabled && (
              <Button icon="book-open" variant="secondary" onClick={onUseSavedQuery} fullWidth>
                <Trans i18nKey="dashboard.new-panel.menu-use-saved-query">Use saved query</Trans>
              </Button>
            )}
            <Button icon="library-panel" variant="secondary" onClick={onUseLibraryPanel} fullWidth>
              <Trans i18nKey="dashboard.new-panel.menu-use-library-panel">Use library panel</Trans>
            </Button>
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

sceneUtils.registerRuntimePanelPlugin({
  pluginId: UNCONFIGURED_PANEL_PLUGIN_ID,
  plugin: UnconfiguredPanel,
});

function getStyles(theme: GrafanaTheme2) {
  return {
    root: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    }),
    buttonList: css({
      display: 'none',
      flexDirection: 'column',
      gap: theme.spacing(1),
      width: theme.spacing(34),
      'section:hover &': { display: 'flex' },
      '[data-selected] &': { display: 'flex' },
    }),
    quietState: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(1),
      'section:hover &': { display: 'none' },
      '[data-selected] &': { display: 'none' },
    }),
    gearIconWrapper: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: `1px dashed ${theme.colors.text.secondary}`,
      borderRadius: theme.shape.radius.circle,
      padding: theme.spacing(1.5),
      color: theme.colors.text.secondary,
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
