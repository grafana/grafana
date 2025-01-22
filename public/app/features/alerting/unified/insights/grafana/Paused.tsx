import { ThresholdsMode } from '@grafana/data';
import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

import { INSTANCE_ID, PANEL_STYLES } from '../../home/Insights';
import { InsightsMenuButton } from '../InsightsMenuButton';

export function getPausedGrafanaAlertsScene(datasource: DataSourceRef, panelTitle: string) {
  const expr = INSTANCE_ID
    ? `sum by (state) (grafanacloud_grafana_instance_alerting_rule_group_rules{state="paused", id="${INSTANCE_ID}"})`
    : `sum by (state) (grafanacloud_grafana_instance_alerting_rule_group_rules{state="paused"})`;

  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        instant: true,
        expr,
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.stat()
      .setTitle(panelTitle)
      .setDescription('The number of current paused alert rules')
      .setData(query)
      .setThresholds({
        mode: ThresholdsMode.Absolute,
        steps: [
          {
            color: 'yellow',
            value: 0,
          },
          {
            color: 'red',
            value: 80,
          },
        ],
      })
      .setNoValue('0')
      .setHeaderActions([new InsightsMenuButton({ panel: panelTitle })])
      .build(),
  });
}
