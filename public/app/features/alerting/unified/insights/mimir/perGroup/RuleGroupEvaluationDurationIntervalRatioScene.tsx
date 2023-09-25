import { PanelBuilders, SceneDataTransformer, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';

import { PANEL_STYLES } from '../../../home/Insights';

export function getRuleGroupEvaluationDurationIntervalRatioScene(
  timeRange: SceneTimeRange,
  datasource: DataSourceRef,
  panelTitle: string
) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: `grafanacloud_instance_rule_group_last_duration_seconds{rule_group="$rule_group"}`,
        range: true,
        legendFormat: 'duration',
      },
      {
        refId: 'B',
        expr: `grafanacloud_instance_rule_group_interval_seconds{rule_group="$rule_group"}`,
        range: true,
        legendFormat: 'interval',
      },
    ],
    $timeRange: timeRange,
  });

  const transformation = new SceneDataTransformer({
    $data: query,
    transformations: [
      {
        id: 'calculateField',
        options: {
          mode: 'binary',

          binary: {
            left: 'duration',
            reducer: 'sum',
            operator: '/',
            right: 'interval',
          },
          replaceFields: true,
        },
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setDescription(panelTitle)
      .setData(transformation)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setUnit('s')
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setOption('legend', { showLegend: false })
      .build(),
  });
}
