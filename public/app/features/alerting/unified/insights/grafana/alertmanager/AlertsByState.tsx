import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';

import { INSTANCE_ID, PANEL_STYLES, overrideToFixedColor } from '../../../home/Insights';
import { InsightsMenuButton } from '../../InsightsMenuButton';

export function getAlertsByStateScene(datasource: DataSourceRef, panelTitle: string) {
  const expr = INSTANCE_ID
    ? `sum by (state) (grafanacloud_grafana_instance_alerting_alertmanager_alerts{id="${INSTANCE_ID}"})`
    : `sum by (state) (grafanacloud_grafana_instance_alerting_alertmanager_alerts)`;

  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr,
        range: true,
        legendFormat: '{{state}}',
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setDescription('A breakdown of all of your firing alert rule instances based on state')
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setOverrides((b) => b.matchFieldsWithName('active').overrideColor(overrideToFixedColor('active')))
      .setHeaderActions([new InsightsMenuButton({ panel: panelTitle })])
      .build(),
  });
}
