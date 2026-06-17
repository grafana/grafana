import { getDataSourceRef } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { SceneDataTransformer, SceneQueryRunner, VizPanel, VizPanelMenu } from '@grafana/scenes';
import { DashboardDatasourceBehaviour } from 'app/features/dashboard-scene/scene/DashboardDatasourceBehaviour';
import { VizPanelLinks, VizPanelLinksMenu } from 'app/features/dashboard-scene/scene/PanelLinks';
import { panelMenuBehavior } from 'app/features/dashboard-scene/scene/PanelMenuBehavior';
import { VizPanelHeaderActions } from 'app/features/dashboard-scene/scene/VizPanelHeaderActions';
import { VizPanelSubHeader } from 'app/features/dashboard-scene/scene/VizPanelSubHeader';
import { setDashboardPanelContext } from 'app/features/dashboard-scene/scene/setDashboardPanelContext';
import { getDefaultPluginId } from 'app/features/dashboard-scene/utils/getDefaultPluginId';

export function getDefaultVizPanel(): VizPanel {
  const defaultPluginId = getDefaultPluginId();

  const newPanelTitle = t('dashboard.new-panel-title', 'New panel');

  const datasourceSettings = getDataSourceSrv().getInstanceSettings(null);

  return new VizPanel({
    title: newPanelTitle,
    pluginId: defaultPluginId,
    seriesLimit: config.panelSeriesLimit,
    titleItems: [new VizPanelLinks({ menu: new VizPanelLinksMenu({}) })],
    hoverHeaderOffset: 0,
    $behaviors: [],
    subHeader: new VizPanelSubHeader({
      hideNonApplicableDrilldowns: !config.featureToggles.perPanelNonApplicableDrilldowns,
    }),
    extendPanelContext: setDashboardPanelContext,
    menu: new VizPanelMenu({
      $behaviors: [panelMenuBehavior],
    }),
    headerActions: new VizPanelHeaderActions({
      hideGroupByAction:
        !config.featureToggles.panelGroupBy && !config.featureToggles.dashboardUnifiedDrilldownControls,
    }),
    $data: datasourceSettings
      ? new SceneDataTransformer({
          $data: new SceneQueryRunner({
            queries: [{ refId: 'A' }],
            datasource: getDataSourceRef(datasourceSettings),
            $behaviors: [new DashboardDatasourceBehaviour({})],
          }),
          transformations: [],
        })
      : undefined,
  });
}
