import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { BigValueGraphMode, DataSourceRef } from '@grafana/schema';

import { INSTANCE_ID, PANEL_STYLES } from '../../home/Insights';
import { InsightsMenuButton } from '../InsightsMenuButton';

export function getInvalidConfigScene(datasource: DataSourceRef, panelTitle: string) {
  const expr = INSTANCE_ID
    ? `sum by (cluster)(grafanacloud_instance_alertmanager_invalid_config{stack_id="${INSTANCE_ID}"})`
    : `sum by (cluster)(grafanacloud_instance_alertmanager_invalid_config)`;

  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr,
        range: true,
        legendFormat: '{{cluster}}',
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.stat()
      .setTitle(panelTitle)
      .setDescription('The current state of your alertmanager configuration')
      .setData(query)
      .setUnit('bool_yes_no')
      .setOption('graphMode', BigValueGraphMode.None)
      .setHeaderActions([new InsightsMenuButton({ panel: panelTitle })])
      .build(),
  });
}
