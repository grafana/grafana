import { ThresholdsMode } from '@grafana/data';
import { PanelBuilders, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';

import { PANEL_STYLES } from '../../../home/Insights';

export function getInstancesPercentageByStateScene(
  timeRange: SceneTimeRange,
  datasource: DataSourceRef,
  panelTitle: string
) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: 'sum by (alertstate) (ALERTS) / ignoring(alertstate) group_left sum(ALERTS)',
        range: true,
        legendFormat: '{{alertstate}}',
      },
    ],
    $timeRange: timeRange,
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setCustomFieldConfig('fillOpacity', 45)
      .setUnit('percentunit')
      .setMax(1)
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setThresholds({
        mode: ThresholdsMode.Absolute,
        steps: [
          {
            color: 'green',
            value: 0,
          },
          {
            color: 'red',
            value: 80,
          },
        ],
      })
      .build(),
  });
}
