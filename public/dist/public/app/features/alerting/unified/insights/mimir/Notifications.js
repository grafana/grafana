import React from 'react';
import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';
import { overrideToFixedColor, PANEL_STYLES } from '../../home/Insights';
import { InsightsRatingModal } from '../RatingModal';
export function getNotificationsScene(datasource, panelTitle) {
    const query = new SceneQueryRunner({
        datasource,
        queries: [
            {
                refId: 'A',
                expr: 'sum by(cluster)(grafanacloud_instance_alertmanager_notifications_per_second) - sum by (cluster)(grafanacloud_instance_alertmanager_notifications_failed_per_second)',
                range: true,
                legendFormat: 'success',
            },
            {
                refId: 'B',
                expr: 'sum by(cluster)(grafanacloud_instance_alertmanager_notifications_failed_per_second)',
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
//# sourceMappingURL=Notifications.js.map