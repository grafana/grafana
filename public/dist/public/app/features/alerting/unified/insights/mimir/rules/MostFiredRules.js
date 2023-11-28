import React from 'react';
import { PanelBuilders, SceneDataTransformer, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { PANEL_STYLES } from '../../../home/Insights';
import { InsightsRatingModal } from '../../RatingModal';
export function getMostFiredRulesScene(datasource, panelTitle) {
    const query = new SceneQueryRunner({
        datasource,
        queries: [
            {
                refId: 'A',
                expr: 'topk(10, sum by(alertname) (ALERTS{alertstate="firing"}))',
                instant: true,
                range: false,
                format: 'table',
            },
        ],
    });
    const transformation = new SceneDataTransformer({
        $data: query,
        transformations: [
            {
                id: 'organize',
                options: {
                    excludeByName: {
                        Time: true,
                    },
                    indexByName: {},
                    renameByName: {
                        Value: 'Number of fires',
                        alertname: 'Alert Rule Name',
                    },
                },
            },
        ],
    });
    return new SceneFlexItem(Object.assign(Object.assign({}, PANEL_STYLES), { body: PanelBuilders.table()
            .setTitle(panelTitle)
            .setDescription('The alert rules that have fired the most')
            .setData(transformation)
            .setHeaderActions(React.createElement(InsightsRatingModal, { panel: panelTitle }))
            .build() }));
}
//# sourceMappingURL=MostFiredRules.js.map