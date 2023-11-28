import React from 'react';
import { ThresholdsMode } from '@grafana/data';
import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { PANEL_STYLES } from '../../../home/Insights';
import { InsightsRatingModal } from '../../RatingModal';
export function getFiringCloudAlertsScene(datasource, panelTitle) {
    const query = new SceneQueryRunner({
        datasource,
        queries: [
            {
                refId: 'A',
                instant: true,
                expr: 'sum by (alertstate) (ALERTS{alertstate="firing"})',
            },
        ],
    });
    return new SceneFlexItem(Object.assign(Object.assign({}, PANEL_STYLES), { body: PanelBuilders.stat()
            .setTitle(panelTitle)
            .setDescription('The number of currently firing alert rule instances')
            .setData(query)
            .setThresholds({
            mode: ThresholdsMode.Absolute,
            steps: [
                {
                    color: 'red',
                    value: 0,
                },
                {
                    color: 'red',
                    value: 80,
                },
            ],
        })
            .setNoValue('0')
            .setHeaderActions(React.createElement(InsightsRatingModal, { panel: panelTitle }))
            .build() }));
}
//# sourceMappingURL=Firing.js.map