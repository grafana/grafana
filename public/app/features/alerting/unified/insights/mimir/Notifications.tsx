import { PanelBuilders, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle } from '@grafana/schema';

const QUERY_A =
  'sum by(cluster)(grafanacloud_instance_alertmanager_notifications_per_second) - sum by (cluster)(grafanacloud_instance_alertmanager_notifications_failed_per_second)';
const QUERY_B = 'sum by(cluster)(grafanacloud_instance_alertmanager_notifications_failed_per_second)';

export function getNotificationsScene(timeRange: SceneTimeRange, datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: QUERY_A,
        range: true,
        legendFormat: '{{cluster}} - success',
      },
      {
        refId: 'B',
        expr: QUERY_B,
        range: true,
        legendFormat: '{{cluster}} - failed',
      },
    ],
    $timeRange: timeRange,
  });

  return new SceneFlexItem({
    width: 'calc(50% - 4px)',
    height: 300,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .build(),
  });
}
