import React from 'react';
import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';
import { overrideToFixedColor, PANEL_STYLES } from '../../home/Insights';
import { InsightsRatingModal } from '../RatingModal';
export function getGrafanaRulesByEvaluationPercentageScene(datasource, panelTitle) {
    const query = new SceneQueryRunner({
        datasource,
        queries: [
            {
                refId: 'A',
                expr: 'sum by (state) (grafanacloud_grafana_instance_alerting_rule_group_rules) / ignoring(state) group_left sum(grafanacloud_grafana_instance_alerting_rule_group_rules)',
                range: true,
                legendFormat: '{{state}} evaluation',
            },
        ],
    });
    return new SceneFlexItem(Object.assign(Object.assign({}, PANEL_STYLES), { body: PanelBuilders.timeseries()
            .setTitle(panelTitle)
            .setDescription('See what percentage of your alert rules are paused or active')
            .setData(query)
            .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
            .setCustomFieldConfig('fillOpacity', 45)
            .setUnit('percentunit')
            .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
            .setMax(1)
            .setOverrides((b) => b.matchFieldsWithName('active evaluation').overrideColor(overrideToFixedColor('active evaluation')))
            .setHeaderActions(React.createElement(InsightsRatingModal, { panel: panelTitle }))
            .build() }));
}
//# sourceMappingURL=RulesByEvaluationPercentage.js.map