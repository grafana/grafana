import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';

import { PANEL_STYLES, overrideToFixedColor } from '../../../home/Insights';
import { InsightsMenuButton } from '../../InsightsMenuButton';

export function getGrafanaAlertmanagerNotificationsScene(datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: '(grafanacloud_grafana_instance_alerting_notifications_total:rate5m - grafanacloud_grafana_instance_alerting_notifications_failed_total:rate5m) or vector(0)',
        range: true,
        legendFormat: 'success',
      },
      {
        refId: 'B',
        expr: 'grafanacloud_grafana_instance_alerting_notifications_failed_total:rate5m',
        range: true,
        legendFormat: 'failed',
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setDescription('The number of successful and failed notifications')
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setOverrides((b) =>
        b
          .matchFieldsWithName('success')
          .overrideColor(overrideToFixedColor('success'))
          .matchFieldsWithName('failed')
          .overrideColor(overrideToFixedColor('failed'))
      )
      .setHeaderActions([new InsightsMenuButton({ panel: panelTitle })])
      .build(),
  });
}
