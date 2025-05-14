import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

import { INSTANCE_ID, overrideToFixedColor } from '../../home/Insights';
import { InsightsMenuButton } from '../InsightsMenuButton';
export function getInstanceStatByStatusScene(
  datasource: DataSourceRef,
  panelTitle: string,
  panelDescription: string,
  status: 'alerting' | 'pending' | 'nodata' | 'normal' | 'error'
) {
  const expr = INSTANCE_ID
    ? `sum by (state) (grafanacloud_grafana_instance_alerting_alerts{state="${status}", id="${INSTANCE_ID}"})`
    : `sum by (state) (grafanacloud_grafana_instance_alerting_alerts{state="${status}"})`;

  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        instant: true,
        expr,
        legendFormat: '{{state}}',
      },
    ],
  });

  return new SceneFlexItem({
    height: '100%',
    body: PanelBuilders.stat()
      .setTitle(panelTitle)
      .setDescription(panelDescription)
      .setData(query)
      .setOverrides((b) => b.matchFieldsWithName(status).overrideColor(overrideToFixedColor(status)))
      .setNoValue('0')
      .setHeaderActions([new InsightsMenuButton({ panel: panelTitle })])
      .build(),
  });
}
