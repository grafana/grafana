import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';

import { INSTANCE_ID, PANEL_STYLES, overrideToFixedColor } from '../../home/Insights';
import { InsightsMenuButton } from '../InsightsMenuButton';

export function getGrafanaRulesByEvaluationScene(datasource: DataSourceRef, panelTitle: string) {
  const expr = INSTANCE_ID
    ? `sum by (state) (grafanacloud_grafana_instance_alerting_rule_group_rules{id="${INSTANCE_ID}"})`
    : `sum by (state) (grafanacloud_grafana_instance_alerting_rule_group_rules)`;

  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr,
        range: true,
        legendFormat: '{{state}} evaluation',
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setDescription('See how many of your alert rules are paused or active')
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setOverrides((b) =>
        b.matchFieldsWithName('active evaluation').overrideColor(overrideToFixedColor('active evaluation'))
      )
      .setHeaderActions([new InsightsMenuButton({ panel: panelTitle })])
      .build(),
  });
}
