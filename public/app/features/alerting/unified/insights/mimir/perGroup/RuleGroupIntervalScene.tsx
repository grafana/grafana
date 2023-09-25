import { PanelBuilders, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { BigValueGraphMode, DataSourceRef } from '@grafana/schema';

import { PANEL_STYLES } from '../../../home/Insights';

export function getRuleGroupIntervalScene(timeRange: SceneTimeRange, datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: `grafanacloud_instance_rule_group_interval_seconds{rule_group="$rule_group"}`,
        range: true,
        legendFormat: 'interval',
      },
    ],
    $timeRange: timeRange,
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.stat()
      .setTitle(panelTitle)
      .setDescription(panelTitle)
      .setData(query)
      .setUnit('s')
      .setOption('graphMode', BigValueGraphMode.None)
      .build(),
  });
}
