import React from 'react';
import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';
import { overrideToFixedColor, PANEL_STYLES } from '../../../home/Insights';
import { InsightsRatingModal } from '../../RatingModal';
export function getGrafanaAlertmanagerNotificationsScene(datasource, panelTitle) {
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
    return new SceneFlexItem(Object.assign(Object.assign({}, PANEL_STYLES), { body: PanelBuilders.timeseries()
            .setTitle(panelTitle)
            .setDescription('The number of successful and failed notifications')
            .setData(query)
            .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
            .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
            .setOverrides((b) => b
            .matchFieldsWithName('success')
            .overrideColor(overrideToFixedColor('success'))
            .matchFieldsWithName('failed')
            .overrideColor(overrideToFixedColor('failed')))
            .setHeaderActions(React.createElement(InsightsRatingModal, { panel: panelTitle }))
            .build() }));
}
//# sourceMappingURL=NotificationsScene.js.map