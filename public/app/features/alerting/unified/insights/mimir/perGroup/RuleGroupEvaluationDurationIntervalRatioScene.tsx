import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, ThresholdsMode, TooltipDisplayMode } from '@grafana/schema';

import { INSTANCE_ID, PANEL_STYLES } from '../../../home/Insights';
import { InsightsMenuButton } from '../../InsightsMenuButton';

export function getRuleGroupEvaluationDurationIntervalRatioScene(datasource: DataSourceRef, panelTitle: string) {
  const expr = INSTANCE_ID
    ? `grafanacloud_instance_rule_group_last_duration_seconds{rule_group="$rule_group", id="${INSTANCE_ID}"} / grafanacloud_instance_rule_group_interval_seconds{rule_group="$rule_group", id="${INSTANCE_ID}"}`
    : `grafanacloud_instance_rule_group_last_duration_seconds{rule_group="$rule_group"} / grafanacloud_instance_rule_group_interval_seconds{rule_group="$rule_group"}`;

  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr,
        range: true,
        legendFormat: 'duration / interval',
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setDescription('The percentage of interval time spent evaluating')
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setOption('legend', { showLegend: false })
      .setUnit('percentunit')
      .setThresholds({
        mode: ThresholdsMode.Percentage,
        steps: [
          {
            color: 'green',
            value: 0,
          },
          {
            color: 'red',
            value: 80,
          },
          {
            color: 'yellow',
            value: 60,
          },
        ],
      })
      .setHeaderActions([new InsightsMenuButton({ panel: panelTitle })])
      .build(),
  });
}
