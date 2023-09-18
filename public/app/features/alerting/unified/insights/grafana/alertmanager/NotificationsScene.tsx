import { PanelBuilders, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle } from '@grafana/schema';

const QUERY_A =
  'grafanacloud_grafana_instance_alerting_notifications_total:rate5m - grafanacloud_grafana_instance_alerting_notifications_failed_total:rate5m';
const QUERY_B = 'grafanacloud_grafana_instance_alerting_notifications_failed_total:rate5m';

export function getGrafanaAlertmanagerNotificationsScene(
  timeRange: SceneTimeRange,
  datasource: DataSourceRef,
  panelTitle: string
) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: QUERY_A,
        range: true,
        legendFormat: 'success',
      },
      {
        refId: 'B',
        expr: QUERY_B,
        range: true,
        legendFormat: 'failed',
      },
    ],
    $timeRange: timeRange,
  });

  return new SceneFlexItem({
    minHeight: 300,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .build(),
  });
}
