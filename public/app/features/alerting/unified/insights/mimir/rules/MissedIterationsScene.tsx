import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';

import { INSTANCE_ID, PANEL_STYLES, overrideToFixedColor } from '../../../home/Insights';
import { InsightsMenuButton } from '../../InsightsMenuButton';

export function getMissedIterationsScene(datasource: DataSourceRef, panelTitle: string) {
  const expr = INSTANCE_ID
    ? `sum(grafanacloud_instance_rule_group_iterations_missed_total:rate5m{id="${INSTANCE_ID}"})`
    : `sum(grafanacloud_instance_rule_group_iterations_missed_total:rate5m)`;

  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr,
        range: true,
        legendFormat: 'missed',
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setDescription('The number of evaluations missed')
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setOption('legend', { showLegend: false })
      .setOverrides((b) => b.matchFieldsWithName('missed').overrideColor(overrideToFixedColor('missed')))
      .setHeaderActions([new InsightsMenuButton({ panel: panelTitle })])
      .build(),
  });
}
