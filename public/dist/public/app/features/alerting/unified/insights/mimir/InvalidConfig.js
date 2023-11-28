import React from 'react';
import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { BigValueGraphMode } from '@grafana/schema';
import { PANEL_STYLES } from '../../home/Insights';
import { InsightsRatingModal } from '../RatingModal';
export function getInvalidConfigScene(datasource, panelTitle) {
    const query = new SceneQueryRunner({
        datasource,
        queries: [
            {
                refId: 'A',
                expr: 'sum by (cluster)(grafanacloud_instance_alertmanager_invalid_config)',
                range: true,
                legendFormat: '{{cluster}}',
            },
        ],
    });
    return new SceneFlexItem(Object.assign(Object.assign({}, PANEL_STYLES), { body: PanelBuilders.stat()
            .setTitle(panelTitle)
            .setDescription('The current state of your alertmanager configuration')
            .setData(query)
            .setUnit('bool_yes_no')
            .setOption('graphMode', BigValueGraphMode.None)
            .setHeaderActions(React.createElement(InsightsRatingModal, { panel: panelTitle }))
            .build() }));
}
//# sourceMappingURL=InvalidConfig.js.map