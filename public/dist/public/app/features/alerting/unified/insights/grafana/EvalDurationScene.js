import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';
import { overrideToFixedColor, PANEL_STYLES } from '../../home/Insights';
export function getGrafanaEvalDurationScene(datasource, panelTitle) {
    const query = new SceneQueryRunner({
        datasource,
        queries: [
            {
                refId: 'A',
                expr: 'sum(grafanacloud_grafana_instance_alerting_rule_evaluations_total:rate5m) - sum(grafanacloud_grafana_instance_alerting_rule_evaluation_failures_total:rate5m)',
                range: true,
                legendFormat: 'success',
            },
            {
                refId: 'B',
                expr: 'sum(grafanacloud_grafana_instance_alerting_rule_evaluation_failures_total:rate5m)',
                range: true,
                legendFormat: 'failed',
            },
        ],
    });
    return new SceneFlexItem(Object.assign(Object.assign({}, PANEL_STYLES), { body: PanelBuilders.timeseries()
            .setTitle(panelTitle)
            .setDescription(panelTitle)
            .setData(query)
            .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
            .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
            .setOverrides((b) => b
            .matchFieldsWithName('success')
            .overrideColor(overrideToFixedColor('success'))
            .matchFieldsWithName('failed')
            .overrideColor(overrideToFixedColor('failed')))
            .build() }));
}
//# sourceMappingURL=EvalDurationScene.js.map