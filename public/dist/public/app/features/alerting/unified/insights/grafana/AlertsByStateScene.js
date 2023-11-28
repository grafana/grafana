import React from 'react';
import { PanelBuilders, SceneDataTransformer, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';
import { overrideToFixedColor, PANEL_STYLES } from '../../home/Insights';
import { InsightsRatingModal } from '../RatingModal';
export function getGrafanaInstancesByStateScene(datasource, panelTitle) {
    const query = new SceneQueryRunner({
        datasource,
        queries: [
            {
                refId: 'A',
                expr: 'sum by (state) (grafanacloud_grafana_instance_alerting_alerts)',
                range: true,
                legendFormat: '{{state}}',
            },
        ],
    });
    const transformation = new SceneDataTransformer({
        $data: query,
        transformations: [
            {
                id: 'renameByRegex',
                options: {
                    regex: 'alerting',
                    renamePattern: 'firing',
                },
            },
        ],
    });
    return new SceneFlexItem(Object.assign(Object.assign({}, PANEL_STYLES), { height: '400px', body: PanelBuilders.timeseries()
            .setTitle(panelTitle)
            .setDescription('A breakdown of all of your alert rule instances based on state')
            .setData(transformation)
            .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
            .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
            .setOverrides((b) => b
            .matchFieldsWithName('firing')
            .overrideColor(overrideToFixedColor('firing'))
            .matchFieldsWithName('normal')
            .overrideColor(overrideToFixedColor('normal'))
            .matchFieldsWithName('pending')
            .overrideColor(overrideToFixedColor('pending'))
            .matchFieldsWithName('error')
            .overrideColor(overrideToFixedColor('error'))
            .matchFieldsWithName('nodata')
            .overrideColor(overrideToFixedColor('nodata')))
            .setHeaderActions(React.createElement(InsightsRatingModal, { panel: panelTitle }))
            .build() }));
}
//# sourceMappingURL=AlertsByStateScene.js.map