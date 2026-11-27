import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { BigValueGraphMode, type DataSourceRef } from '@grafana/schema';

import { InsightsMenuButton } from '../../InsightsMenuButton';
import { INSTANCE_ID, PANEL_STYLES } from '../../utils';

export function getRuleGroupIntervalScene(datasource: DataSourceRef, panelTitle: string) {
  const expr = INSTANCE_ID
    ? `grafanacloud_instance_rule_group_interval_seconds{rule_group="$rule_group", stack_id="${INSTANCE_ID}"}`
    : `grafanacloud_instance_rule_group_interval_seconds{rule_group="$rule_group"}`;

  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr,
        range: true,
        legendFormat: 'interval',
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.stat()
      .setTitle(panelTitle)
      .setDescription('The current and historical rule group evaluation interval')
      .setData(query)
      .setUnit('s')
      .setOption('graphMode', BigValueGraphMode.Area)
      .setHeaderActions([new InsightsMenuButton({ panel: panelTitle })])
      .build(),
  });
}
