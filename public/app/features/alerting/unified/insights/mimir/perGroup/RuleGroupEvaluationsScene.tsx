import { PanelBuilders, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle } from '@grafana/schema';

const QUERY_A = `grafanacloud_instance_rule_evaluations_total:rate5m{rule_group="$rule_group"} - grafanacloud_instance_rule_evaluation_failures_total:rate5m{rule_group=~"$rule_group"}`;
const QUERY_B = `grafanacloud_instance_rule_evaluation_failures_total:rate5m{rule_group=~"$rule_group"}`;

export function getRuleGroupEvaluationsScene(timeRange: SceneTimeRange, datasource: DataSourceRef, panelTitle: string) {
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
    width: 'calc(50% - 4px)',
    height: 300,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .build(),
  });
}
