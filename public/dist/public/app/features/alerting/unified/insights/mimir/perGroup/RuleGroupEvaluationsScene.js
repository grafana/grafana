import React from 'react';
import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';
import { overrideToFixedColor, PANEL_STYLES } from '../../../home/Insights';
import { InsightsRatingModal } from '../../RatingModal';
export function getRuleGroupEvaluationsScene(datasource, panelTitle) {
    const query = new SceneQueryRunner({
        datasource,
        queries: [
            {
                refId: 'A',
                expr: `grafanacloud_instance_rule_evaluations_total:rate5m{rule_group="$rule_group"} - grafanacloud_instance_rule_evaluation_failures_total:rate5m{rule_group=~"$rule_group"}`,
                range: true,
                legendFormat: 'success',
            },
            {
                refId: 'B',
                expr: `grafanacloud_instance_rule_evaluation_failures_total:rate5m{rule_group=~"$rule_group"}`,
                range: true,
                legendFormat: 'failed',
            },
        ],
    });
    return new SceneFlexItem(Object.assign(Object.assign({}, PANEL_STYLES), { body: PanelBuilders.timeseries()
            .setTitle(panelTitle)
            .setDescription('The number of successful and failed evaluations for the rule group')
            .setData(query)
            .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
            .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
            .setOverrides((b) => b
            .matchFieldsWithName('success')
            .overrideColor(overrideToFixedColor('success'))
            .matchFieldsWithName('failed')
            .overrideColor(overrideToFixedColor('failed')))
            .setHeaderActions(React.createElement(InsightsRatingModal, { panel: panelTitle }))
            .build() }));
}
//# sourceMappingURL=RuleGroupEvaluationsScene.js.map