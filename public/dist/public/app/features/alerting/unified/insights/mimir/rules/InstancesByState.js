import React from 'react';
import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';
import { overrideToFixedColor, PANEL_STYLES } from '../../../home/Insights';
import { InsightsRatingModal } from '../../RatingModal';
export function getInstancesByStateScene(datasource, panelTitle) {
    const query = new SceneQueryRunner({
        datasource,
        queries: [
            {
                refId: 'A',
                expr: 'sum by (alertstate) (ALERTS)',
                range: true,
                legendFormat: '{{state}}',
            },
        ],
    });
    return new SceneFlexItem(Object.assign(Object.assign({}, PANEL_STYLES), { body: PanelBuilders.timeseries()
            .setTitle(panelTitle)
            .setDescription('The number of firing and pending alert rule instances')
            .setData(query)
            .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
            .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
            .setOverrides((b) => b.matchFieldsWithName('firing').overrideColor(overrideToFixedColor('firing')))
            .setHeaderActions(React.createElement(InsightsRatingModal, { panel: panelTitle }))
            .build() }));
}
//# sourceMappingURL=InstancesByState.js.map