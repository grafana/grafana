import { PanelBuilders, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';

import { PANEL_STYLES } from '../../home/Insights';

export function getNotificationsScene(timeRange: SceneTimeRange, datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: 'sum by(cluster)(grafanacloud_instance_alertmanager_notifications_per_second) - sum by (cluster)(grafanacloud_instance_alertmanager_notifications_failed_per_second)',
        range: true,
        legendFormat: 'success',
      },
      {
        refId: 'B',
        expr: 'sum by(cluster)(grafanacloud_instance_alertmanager_notifications_failed_per_second)',
        range: true,
        legendFormat: 'failed',
      },
    ],
    $timeRange: timeRange,
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setDescription(panelTitle)
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setOverrides((b) =>
        b
          .matchFieldsWithName('success')
          .overrideColor({
            mode: 'fixed',
            fixedColor: 'green',
          })
          .matchFieldsWithName('failed')
          .overrideColor({
            mode: 'fixed',
            fixedColor: 'red',
          })
      )
      .build(),
  });
}
