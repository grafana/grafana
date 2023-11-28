import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { GraphDrawStyle } from '@grafana/schema';
import { PANEL_STYLES } from '../../home/Insights';
export function getFiringAlertsRateScene(datasource, panelTitle) {
    const query = new SceneQueryRunner({
        datasource,
        queries: [
            {
                refId: 'A',
                expr: 'sum(count_over_time({from="state-history"} | json | current="Alerting"[5m]))',
                range: true,
                legendFormat: 'Number of fires',
            },
        ],
    });
    return new SceneFlexItem(Object.assign(Object.assign({}, PANEL_STYLES), { body: PanelBuilders.timeseries()
            .setTitle(panelTitle)
            .setDescription(panelTitle)
            .setData(query)
            .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
            .setCustomFieldConfig('fillOpacity', 10)
            .setCustomFieldConfig('spanNulls', true)
            .setCustomFieldConfig('pointSize', 5)
            .build() }));
}
//# sourceMappingURL=FiringAlertsRate.js.map