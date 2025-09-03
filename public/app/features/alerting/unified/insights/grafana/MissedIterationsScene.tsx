import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';

import { INSTANCE_ID, PANEL_STYLES } from '../../home/Insights';
import { InsightsMenuButton } from '../InsightsMenuButton';

export function getGrafanaMissedIterationsScene(datasource: DataSourceRef, panelTitle: string) {
  const expr = `sum by(rule_title) (grafanacloud_grafana_instance_alerting_schedule_rule_evaluations_missed_total:rate5m{id="${INSTANCE_ID}"})`;
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr,
        range: true,
        legendFormat: '{{rule_title}}',
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setDescription('The number of missed iterations per alert rule')
      .setData(query)
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setHeaderActions([new InsightsMenuButton({ panel: panelTitle })])
      .build(),
  });
}
