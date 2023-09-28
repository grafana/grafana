import { PanelBuilders, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle } from '@grafana/schema';

import { PANEL_STYLES } from '../../../home/Insights';

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
        expr: 'grafanacloud_grafana_instance_alerting_notifications_total:rate5m - grafanacloud_grafana_instance_alerting_notifications_failed_total:rate5m',
        range: true,
        legendFormat: 'success',
      },
      {
        refId: 'B',
        expr: 'grafanacloud_grafana_instance_alerting_notifications_failed_total:rate5m',
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
      .setOverrides((b) =>
        b
          .matchFieldsWithName('alerting')
          .overrideColor({
            mode: 'fixed',
            fixedColor: 'red',
          })
          .matchFieldsWithName('normal')
          .overrideColor({
            mode: 'fixed',
            fixedColor: 'green',
          })
          .matchFieldsWithName('pending')
          .overrideColor({
            mode: 'fixed',
            fixedColor: 'yellow',
          })
          .matchFieldsWithName('error')
          .overrideColor({
            mode: 'fixed',
            fixedColor: 'orange',
          })
          .matchFieldsWithName('nodata')
          .overrideColor({
            mode: 'fixed',
            fixedColor: 'blue',
          })
      )
      .build(),
  });
}
