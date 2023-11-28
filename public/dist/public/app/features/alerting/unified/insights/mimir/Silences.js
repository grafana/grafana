import React from 'react';
import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';
import { PANEL_STYLES } from '../../home/Insights';
import { InsightsRatingModal } from '../RatingModal';
export function getSilencesScene(datasource, panelTitle) {
    const query = new SceneQueryRunner({
        datasource,
        queries: [
            {
                refId: 'A',
                expr: 'sum by (state) (grafanacloud_instance_alertmanager_silences)',
                range: true,
                legendFormat: '{{state}}',
            },
        ],
    });
    return new SceneFlexItem(Object.assign(Object.assign({}, PANEL_STYLES), { body: PanelBuilders.timeseries()
            .setTitle(panelTitle)
            .setDescription('The number of silences by state')
            .setData(query)
            .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
            .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
            .setHeaderActions(React.createElement(InsightsRatingModal, { panel: panelTitle }))
            .build() }));
}
//# sourceMappingURL=Silences.js.map