import React from 'react';
import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';
import { overrideToFixedColor, PANEL_STYLES } from '../../../home/Insights';
import { InsightsRatingModal } from '../../RatingModal';
export function getEvalSuccessVsFailuresScene(datasource, panelTitle) {
    const query = new SceneQueryRunner({
        datasource,
        queries: [
            {
                refId: 'A',
                expr: 'sum(grafanacloud_instance_rule_evaluations_total:rate5m) - sum(grafanacloud_instance_rule_evaluation_failures_total:rate5m)',
                range: true,
                legendFormat: 'success',
            },
            {
                refId: 'B',
                expr: 'sum(grafanacloud_instance_rule_evaluation_failures_total:rate5m)',
                range: true,
                legendFormat: 'failed',
            },
        ],
    });
    return new SceneFlexItem(Object.assign(Object.assign({}, PANEL_STYLES), { body: PanelBuilders.timeseries()
            .setTitle(panelTitle)
            .setDescription('The number of successful and failed alert rule evaluations')
            .setData(query)
            .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
            .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
            .setOverrides((b) => b.matchFieldsWithName('failed').overrideColor(overrideToFixedColor('failed')))
            .setHeaderActions(React.createElement(InsightsRatingModal, { panel: panelTitle }))
            .build() }));
}
//# sourceMappingURL=EvalSuccessVsFailuresScene.js.map