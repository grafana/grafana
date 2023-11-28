import React from 'react';
import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { overrideToFixedColor } from '../../home/Insights';
import { InsightsRatingModal } from '../RatingModal';
export function getInstanceStatByStatusScene(datasource, panelTitle, panelDescription, status) {
    const query = new SceneQueryRunner({
        datasource,
        queries: [
            {
                refId: 'A',
                instant: true,
                expr: `sum by (state) (grafanacloud_grafana_instance_alerting_alerts{state="${status}"})`,
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
            .setHeaderActions(React.createElement(InsightsRatingModal, { panel: panelTitle }))
            .build(),
    });
}
//# sourceMappingURL=InstanceStatusScene.js.map