import { isCloudRulesSource, isGrafanaRulesSource } from './datasource';
import { isGrafanaRulerRule } from './rules';
export function alertRuleToQueries(combinedRule) {
    if (!combinedRule) {
        return [];
    }
    const { namespace, rulerRule } = combinedRule;
    const { rulesSource } = namespace;
    if (isGrafanaRulesSource(rulesSource)) {
        if (isGrafanaRulerRule(rulerRule)) {
            return rulerRule.grafana_alert.data;
        }
    }
    if (isCloudRulesSource(rulesSource)) {
        const model = cloudAlertRuleToModel(rulesSource, combinedRule);
        return [dataQueryToAlertQuery(model, rulesSource.uid)];
    }
    return [];
}
export function dataQueryToAlertQuery(dataQuery, dataSourceUid) {
    return {
        refId: dataQuery.refId,
        datasourceUid: dataSourceUid,
        queryType: '',
        model: dataQuery,
        relativeTimeRange: {
            from: 360,
            to: 0,
        },
    };
}
function cloudAlertRuleToModel(dsSettings, rule) {
    const refId = 'A';
    switch (dsSettings.type) {
        case 'prometheus': {
            const query = {
                refId,
                expr: rule.query,
            };
            return query;
        }
        case 'loki': {
            const query = {
                refId,
                expr: rule.query,
            };
            return query;
        }
        default:
            throw new Error(`Query for datasource type ${dsSettings.type} is currently not supported by cloud alert rules.`);
    }
}
//# sourceMappingURL=query.js.map