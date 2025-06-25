import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';

import { INSTANCE_ID, PANEL_STYLES } from '../../../home/Insights';
import { InsightsMenuButton } from '../../InsightsMenuButton';

export function getRuleGroupEvaluationDurationScene(datasource: DataSourceRef, panelTitle: string) {
  const expr = INSTANCE_ID
    ? `grafanacloud_instance_rule_group_last_duration_seconds{rule_group="$rule_group", stack_id="${INSTANCE_ID}"}`
    : `grafanacloud_instance_rule_group_last_duration_seconds{rule_group="$rule_group"}`;

  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr,
        range: true,
        legendFormat: '{{rule_group}}',
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setDescription('How long it took to evaluate the rule group')
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setUnit('s')
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setOption('legend', { showLegend: false })
      .setOverrides((b) =>
        b.matchFieldsByQuery('A').overrideColor({
          mode: 'fixed',
          fixedColor: 'blue',
        })
      )
      .setHeaderActions([new InsightsMenuButton({ panel: panelTitle })])
      .build(),
  });
}
