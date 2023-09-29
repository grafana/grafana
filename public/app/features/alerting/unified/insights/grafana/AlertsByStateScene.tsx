import { PanelBuilders, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';

import { PANEL_STYLES } from '../../home/Insights';

export function getGrafanaInstancesByStateScene(
  timeRange: SceneTimeRange,
  datasource: DataSourceRef,
  panelTitle: string
) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: 'sum by (state) (grafanacloud_grafana_instance_alerting_alerts)',
        range: true,
        legendFormat: '{{state}}',
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
