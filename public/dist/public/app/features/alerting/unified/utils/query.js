import { isCloudRulesSource, isGrafanaRulesSource } from './datasource';
import { isGrafanaRulerRule } from './rules';
export function alertRuleToQueries(combinedRule) {
    if (!combinedRule) {
        return [];
    }
    var namespace = combinedRule.namespace, rulerRule = combinedRule.rulerRule;
    var rulesSource = namespace.rulesSource;
    if (isGrafanaRulesSource(rulesSource)) {
        if (isGrafanaRulerRule(rulerRule)) {
            return rulerRule.grafana_alert.data;
        }
    }
    if (isCloudRulesSource(rulesSource)) {
        var model = cloudAlertRuleToModel(rulesSource, combinedRule);
        return [
            {
                refId: model.refId,
                datasourceUid: rulesSource.uid,
                queryType: '',
                model: model,
                relativeTimeRange: {
                    from: 360,
                    to: 0,
                },
            },
        ];
    }
    return [];
}
function cloudAlertRuleToModel(dsSettings, rule) {
    var refId = 'A';
    switch (dsSettings.type) {
        case 'prometheus': {
            var query = {
                refId: refId,
                expr: rule.query,
            };
            return query;
        }
        case 'loki': {
            var query = {
                refId: refId,
                expr: rule.query,
            };
            return query;
        }
        default:
            throw new Error("Query for datasource type " + dsSettings.type + " is currently not supported by cloud alert rules.");
    }
}
//# sourceMappingURL=query.js.map