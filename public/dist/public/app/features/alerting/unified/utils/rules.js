import { capitalize } from 'lodash';
import { AlertState } from '@grafana/data';
import { GrafanaAlertState, mapStateWithReasonToBaseState, PromAlertingRuleState, PromRuleType, } from 'app/types/unified-alerting-dto';
import { RuleHealth } from '../search/rulesSearchParser';
import { RULER_NOT_SUPPORTED_MSG } from './constants';
import { getRulesSourceName } from './datasource';
import { safeParseDurationstr } from './time';
export function isAlertingRule(rule) {
    return typeof rule === 'object' && rule.type === PromRuleType.Alerting;
}
export function isRecordingRule(rule) {
    return typeof rule === 'object' && rule.type === PromRuleType.Recording;
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
export function isGrafanaRulerRulePaused(rule) {
    return rule.rulerRule && isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.is_paused);
}
export function alertInstanceKey(alert) {
    return JSON.stringify(alert.labels);
}
export function isRulerNotSupportedResponse(resp) {
    var _a, _b;
    return resp.error && ((_b = (_a = resp.error) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.includes(RULER_NOT_SUPPORTED_MSG));
}
export function isGrafanaRuleIdentifier(identifier) {
    return 'uid' in identifier;
}
export function isCloudRuleIdentifier(identifier) {
    return 'rulerRuleHash' in identifier;
}
export function isPromRuleType(ruleType) {
    return Object.values(PromRuleType).includes(ruleType);
}
export function isPrometheusRuleIdentifier(identifier) {
    return 'ruleHash' in identifier;
}
export function getRuleHealth(health) {
    switch (health) {
        case 'ok':
            return RuleHealth.Ok;
        case 'nodata':
            return RuleHealth.NoData;
        case 'error':
        case 'err': // Prometheus-compat data sources
            return RuleHealth.Error;
        case 'unknown':
            return RuleHealth.Unknown;
        default:
            return undefined;
    }
}
export function alertStateToReadable(state) {
    if (state === PromAlertingRuleState.Inactive) {
        return 'Normal';
    }
    return capitalize(state);
}
export const flattenRules = (rules) => {
    return rules.reduce((acc, { dataSourceName, name: namespaceName, groups }) => {
        groups.forEach(({ name: groupName, rules }) => {
            rules.forEach((rule) => {
                if (isAlertingRule(rule)) {
                    acc.push({ dataSourceName, namespaceName, groupName, rule });
                }
            });
        });
        return acc;
    }, []);
};
export const getAlertingRule = (rule) => isAlertingRule(rule.promRule) ? rule.promRule : null;
export const flattenCombinedRules = (rules) => {
    return rules.reduce((acc, { rulesSource, name: namespaceName, groups }) => {
        groups.forEach(({ name: groupName, rules }) => {
            rules.forEach((rule) => {
                if (rule.promRule && isAlertingRule(rule.promRule)) {
                    acc.push(Object.assign({ dataSourceName: getRulesSourceName(rulesSource), namespaceName, groupName }, rule));
                }
            });
        });
        return acc;
    }, []);
};
export function alertStateToState(state) {
    let key;
    if (Object.values(AlertState).includes(state)) {
        key = state;
    }
    else {
        key = mapStateWithReasonToBaseState(state);
    }
    return alertStateToStateMap[key];
}
const alertStateToStateMap = {
    [PromAlertingRuleState.Inactive]: 'good',
    [PromAlertingRuleState.Firing]: 'bad',
    [PromAlertingRuleState.Pending]: 'warning',
    [GrafanaAlertState.Alerting]: 'bad',
    [GrafanaAlertState.Error]: 'bad',
    [GrafanaAlertState.NoData]: 'info',
    [GrafanaAlertState.Normal]: 'good',
    [GrafanaAlertState.Pending]: 'warning',
    [AlertState.NoData]: 'info',
    [AlertState.Paused]: 'warning',
    [AlertState.Alerting]: 'bad',
    [AlertState.OK]: 'good',
    [AlertState.Pending]: 'warning',
    [AlertState.Unknown]: 'info',
};
export function getFirstActiveAt(promRule) {
    if (!(promRule === null || promRule === void 0 ? void 0 : promRule.alerts)) {
        return null;
    }
    return promRule.alerts.reduce((prev, alert) => {
        const isNotNormal = mapStateWithReasonToBaseState(alert.state) !== GrafanaAlertState.Normal;
        if (alert.activeAt && isNotNormal) {
            const activeAt = new Date(alert.activeAt);
            if (prev === null || prev.getTime() > activeAt.getTime()) {
                return activeAt;
            }
        }
        return prev;
    }, null);
}
/**
 * A rule group is "federated" when it has at least one "source_tenants" entry, federated rule groups will evaluate rules in multiple tenants
 * Non-federated rules do not have this property
 *
 * see https://grafana.com/docs/metrics-enterprise/latest/tenant-management/tenant-federation/#cross-tenant-alerting-and-recording-rule-federation
 */
export function isFederatedRuleGroup(group) {
    return Array.isArray(group.source_tenants);
}
export function getRuleName(rule) {
    if (isGrafanaRulerRule(rule)) {
        return rule.grafana_alert.title;
    }
    if (isAlertingRulerRule(rule)) {
        return rule.alert;
    }
    if (isRecordingRulerRule(rule)) {
        return rule.record;
    }
    return '';
}
export const getAlertInfo = (alert, currentEvaluation) => {
    var _a, _b;
    const emptyAlert = {
        alertName: '',
        forDuration: '0s',
        evaluationsToFire: 0,
    };
    if (isGrafanaRulerRule(alert)) {
        return {
            alertName: alert.grafana_alert.title,
            forDuration: alert.for,
            evaluationsToFire: getNumberEvaluationsToStartAlerting(alert.for, currentEvaluation),
        };
    }
    if (isAlertingRulerRule(alert)) {
        return {
            alertName: alert.alert,
            forDuration: (_a = alert.for) !== null && _a !== void 0 ? _a : '1m',
            evaluationsToFire: getNumberEvaluationsToStartAlerting((_b = alert.for) !== null && _b !== void 0 ? _b : '1m', currentEvaluation),
        };
    }
    return emptyAlert;
};
export const getNumberEvaluationsToStartAlerting = (forDuration, currentEvaluation) => {
    const evalNumberMs = safeParseDurationstr(currentEvaluation);
    const forNumber = safeParseDurationstr(forDuration);
    if (forNumber === 0 && evalNumberMs !== 0) {
        return 1;
    }
    if (evalNumberMs === 0) {
        return 0;
    }
    else {
        const evaluationsBeforeCeil = forNumber / evalNumberMs;
        return evaluationsBeforeCeil < 1 ? 0 : Math.ceil(forNumber / evalNumberMs) + 1;
    }
};
//# sourceMappingURL=rules.js.map