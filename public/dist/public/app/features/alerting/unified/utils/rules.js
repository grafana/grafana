var _a;
import { GrafanaAlertState, PromAlertingRuleState, PromRuleType, } from 'app/types/unified-alerting-dto';
import { RULER_NOT_SUPPORTED_MSG } from './constants';
import { capitalize } from 'lodash';
export function isAlertingRule(rule) {
    return typeof rule === 'object' && rule.type === PromRuleType.Alerting;
}
export function isRecordingRule(rule) {
    return rule.type === PromRuleType.Recording;
}
export function isAlertingRulerRule(rule) {
    return typeof rule === 'object' && 'alert' in rule;
}
export function isRecordingRulerRule(rule) {
    return typeof rule === 'object' && 'record' in rule;
}
export function isGrafanaRulerRule(rule) {
    return typeof rule === 'object' && 'grafana_alert' in rule;
}
export function alertInstanceKey(alert) {
    return JSON.stringify(alert.labels);
}
export function isRulerNotSupportedResponse(resp) {
    var _a;
    return resp.error && ((_a = resp.error) === null || _a === void 0 ? void 0 : _a.message) === RULER_NOT_SUPPORTED_MSG;
}
export function isGrafanaRuleIdentifier(identifier) {
    return 'uid' in identifier;
}
export function isCloudRuleIdentifier(identifier) {
    return 'rulerRuleHash' in identifier;
}
export function isPrometheusRuleIdentifier(identifier) {
    return 'ruleHash' in identifier;
}
export function alertStateToReadable(state) {
    if (state === PromAlertingRuleState.Inactive) {
        return 'Normal';
    }
    return capitalize(state);
}
export var flattenRules = function (rules) {
    return rules.reduce(function (acc, _a) {
        var dataSourceName = _a.dataSourceName, namespaceName = _a.name, groups = _a.groups;
        groups.forEach(function (_a) {
            var groupName = _a.name, rules = _a.rules;
            rules.forEach(function (rule) {
                if (isAlertingRule(rule)) {
                    acc.push({ dataSourceName: dataSourceName, namespaceName: namespaceName, groupName: groupName, rule: rule });
                }
            });
        });
        return acc;
    }, []);
};
export var alertStateToState = (_a = {},
    _a[PromAlertingRuleState.Inactive] = 'good',
    _a[PromAlertingRuleState.Firing] = 'bad',
    _a[PromAlertingRuleState.Pending] = 'warning',
    _a[GrafanaAlertState.Alerting] = 'bad',
    _a[GrafanaAlertState.Error] = 'bad',
    _a[GrafanaAlertState.NoData] = 'info',
    _a[GrafanaAlertState.Normal] = 'good',
    _a[GrafanaAlertState.Pending] = 'warning',
    _a);
export function getFirstActiveAt(promRule) {
    if (!promRule.alerts) {
        return null;
    }
    return promRule.alerts.reduce(function (prev, alert) {
        if (alert.activeAt && alert.state !== GrafanaAlertState.Normal) {
            var activeAt = new Date(alert.activeAt);
            if (prev === null || prev.getTime() > activeAt.getTime()) {
                return activeAt;
            }
        }
        return prev;
    }, null);
}
//# sourceMappingURL=rules.js.map