import React from 'react';
import { map } from 'rxjs';
import { PanelBuilders, SceneDataTransformer, SceneFlexItem, SceneQueryRunner, } from '@grafana/scenes';
import { GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';
import { PANEL_STYLES } from '../../home/Insights';
import { InsightsRatingModal } from '../RatingModal';
export function getGrafanaMissedIterationsScene(datasource, panelTitle) {
    const query = new SceneQueryRunner({
        datasource,
        queries: [
            {
                refId: 'A',
                expr: 'sum by (rule_group) (grafanacloud_instance_rule_group_iterations_missed_total:rate5m)',
                range: true,
                legendFormat: '{{rule_group}}',
            },
        ],
    });
    const legendTransformation = () => (source) => {
        return source.pipe(map((data) => {
            return data.map((frame) => {
                return Object.assign(Object.assign({}, frame), { fields: frame.fields.map((field) => {
                        const displayNameFromDs = field.config.displayNameFromDS || '';
                        const matches = displayNameFromDs.match(/\/rules\/\d+\/(\w+);(\w+)/);
                        if (matches) {
                            field.config.displayName = `Folder: ${matches[1]} - Group: ${matches[2]}`;
                        }
                        return field;
                    }) });
            });
        }));
    };
    const transformation = new SceneDataTransformer({
        $data: query,
        transformations: [legendTransformation],
    });
    return new SceneFlexItem(Object.assign(Object.assign({}, PANEL_STYLES), { body: PanelBuilders.timeseries()
            .setTitle(panelTitle)
            .setDescription('The number of missed iterations per evaluation group')
            .setData(transformation)
            .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
            .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
            .setHeaderActions(React.createElement(InsightsRatingModal, { panel: panelTitle }))
            .build() }));
}
//# sourceMappingURL=MissedIterationsScene.js.map