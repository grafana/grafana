import React from 'react';
import { ThresholdsMode } from '@grafana/data';
import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { PANEL_STYLES } from '../../home/Insights';
import { InsightsRatingModal } from '../RatingModal';
export function getPausedGrafanaAlertsScene(datasource, panelTitle) {
    const query = new SceneQueryRunner({
        datasource,
        queries: [
            {
                refId: 'A',
                instant: true,
                expr: 'sum by (state) (grafanacloud_grafana_instance_alerting_rule_group_rules{state="paused"})',
            },
        ],
    });
    return new SceneFlexItem(Object.assign(Object.assign({}, PANEL_STYLES), { body: PanelBuilders.stat()
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
            .setHeaderActions(React.createElement(InsightsRatingModal, { panel: panelTitle }))
            .build() }));
}
//# sourceMappingURL=Paused.js.map