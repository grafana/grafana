import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { BigValueGraphMode, DataSourceRef } from '@grafana/schema';

import { INSTANCE_ID, PANEL_STYLES } from '../../../home/Insights';
import { InsightsMenuButton } from '../../InsightsMenuButton';

export function getRulesPerGroupScene(datasource: DataSourceRef, panelTitle: string) {
  const expr = INSTANCE_ID
    ? `sum(grafanacloud_instance_rule_group_rules{rule_group="$rule_group", stack_id="${INSTANCE_ID}"})`
    : `sum(grafanacloud_instance_rule_group_rules{rule_group="$rule_group"})`;

  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr,
        range: true,
        legendFormat: 'number of rules',
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.stat()
      .setTitle(panelTitle)
      .setDescription('The current and historical number of alert rules in the rule group')
      .setData(query)
      .setUnit('none')
      .setOption('graphMode', BigValueGraphMode.Area)
      .setOverrides((b) =>
        b.matchFieldsByQuery('A').overrideColor({
          mode: 'fixed',
          fixedColor: 'blue',
        })
      )
      .setNoValue('0')
      .setHeaderActions([new InsightsMenuButton({ panel: panelTitle })])
      .build(),
  });
}
