import { __read } from "tslib";
import { GRAFANA_RULES_SOURCE_NAME } from './datasource';
import { isAlertingRule, isAlertingRulerRule, isCloudRuleIdentifier, isGrafanaRuleIdentifier, isGrafanaRulerRule, isPrometheusRuleIdentifier, isRecordingRule, isRecordingRulerRule, } from './rules';
export function fromRulerRule(ruleSourceName, namespace, groupName, rule) {
    if (isGrafanaRulerRule(rule)) {
        return { uid: rule.grafana_alert.uid };
    }
    return {
        ruleSourceName: ruleSourceName,
        namespace: namespace,
        groupName: groupName,
        rulerRuleHash: hashRulerRule(rule),
    };
}
export function fromRule(ruleSourceName, namespace, groupName, rule) {
    return {
        ruleSourceName: ruleSourceName,
        namespace: namespace,
        groupName: groupName,
        ruleHash: hashRule(rule),
    };
}
export function fromCombinedRule(ruleSourceName, rule) {
    var namespaceName = rule.namespace.name;
    var groupName = rule.group.name;
    if (rule.rulerRule) {
        return fromRulerRule(ruleSourceName, namespaceName, groupName, rule.rulerRule);
    }
    if (rule.promRule) {
        return fromRule(ruleSourceName, namespaceName, groupName, rule.promRule);
    }
    throw new Error('Could not create an id for a rule that is missing both `rulerRule` and `promRule`.');
}
export function fromRuleWithLocation(rule) {
    return fromRulerRule(rule.ruleSourceName, rule.namespace, rule.group.name, rule.rule);
}
export function equal(a, b) {
    if (isGrafanaRuleIdentifier(a) && isGrafanaRuleIdentifier(b)) {
        return a.uid === b.uid;
    }
    if (isCloudRuleIdentifier(a) && isCloudRuleIdentifier(b)) {
        return (a.groupName === b.groupName &&
            a.namespace === b.namespace &&
            a.rulerRuleHash === b.rulerRuleHash &&
            a.ruleSourceName === b.ruleSourceName);
    }
    if (isPrometheusRuleIdentifier(a) && isPrometheusRuleIdentifier(b)) {
        return (a.groupName === b.groupName &&
            a.namespace === b.namespace &&
            a.ruleHash === b.ruleHash &&
            a.ruleSourceName === b.ruleSourceName);
    }
    return false;
}
var cloudRuleIdentifierPrefix = 'cri';
var prometheusRuleIdentifierPrefix = 'pri';
function escapeDollars(value) {
    return value.replace(/\$/g, '_DOLLAR_');
}
function unesacapeDollars(value) {
    return value.replace(/\_DOLLAR\_/g, '$');
}
export function parse(value, decodeFromUri) {
    if (decodeFromUri === void 0) { decodeFromUri = false; }
    var source = decodeFromUri ? decodeURIComponent(value) : value;
    var parts = source.split('$');
    if (parts.length === 1) {
        return { uid: value };
    }
    if (parts.length === 5) {
        var _a = __read(parts.map(unesacapeDollars), 5), prefix = _a[0], ruleSourceName = _a[1], namespace = _a[2], groupName = _a[3], hash_1 = _a[4];
        if (prefix === cloudRuleIdentifierPrefix) {
            return { ruleSourceName: ruleSourceName, namespace: namespace, groupName: groupName, rulerRuleHash: Number(hash_1) };
        }
        if (prefix === prometheusRuleIdentifierPrefix) {
            return { ruleSourceName: ruleSourceName, namespace: namespace, groupName: groupName, ruleHash: Number(hash_1) };
        }
    }
    throw new Error("Failed to parse rule location: " + value);
}
export function tryParse(value, decodeFromUri) {
    if (decodeFromUri === void 0) { decodeFromUri = false; }
    if (!value) {
        return;
    }
    try {
        return parse(value, decodeFromUri);
    }
    catch (error) {
        return;
    }
}
export function stringifyIdentifier(identifier) {
    if (isGrafanaRuleIdentifier(identifier)) {
        return identifier.uid;
    }
    if (isCloudRuleIdentifier(identifier)) {
        return [
            cloudRuleIdentifierPrefix,
            identifier.ruleSourceName,
            identifier.namespace,
            identifier.groupName,
            identifier.rulerRuleHash,
        ]
            .map(String)
            .map(escapeDollars)
            .join('$');
    }
    return [
        prometheusRuleIdentifierPrefix,
        identifier.ruleSourceName,
        identifier.namespace,
        identifier.groupName,
        identifier.ruleHash,
    ]
        .map(String)
        .map(escapeDollars)
        .join('$');
}
function hash(value) {
    var hash = 0;
    if (value.length === 0) {
        return hash;
    }
    for (var i = 0; i < value.length; i++) {
        var char = value.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}
// this is used to identify lotex rules, as they do not have a unique identifier
function hashRulerRule(rule) {
    if (isRecordingRulerRule(rule)) {
        return hash(JSON.stringify([rule.record, rule.expr, hashLabelsOrAnnotations(rule.labels)]));
    }
    else if (isAlertingRulerRule(rule)) {
        return hash(JSON.stringify([
            rule.alert,
            rule.expr,
            hashLabelsOrAnnotations(rule.annotations),
            hashLabelsOrAnnotations(rule.labels),
        ]));
    }
    else {
        throw new Error('only recording and alerting ruler rules can be hashed');
    }
}
function hashRule(rule) {
    if (isRecordingRule(rule)) {
        return hash(JSON.stringify([rule.type, rule.query, hashLabelsOrAnnotations(rule.labels)]));
    }
    if (isAlertingRule(rule)) {
        return hash(JSON.stringify([
            rule.type,
            rule.query,
            hashLabelsOrAnnotations(rule.annotations),
            hashLabelsOrAnnotations(rule.labels),
        ]));
    }
    throw new Error('only recording and alerting rules can be hashed');
}
function hashLabelsOrAnnotations(item) {
    return JSON.stringify(Object.entries(item || {}).sort(function (a, b) { return a[0].localeCompare(b[0]); }));
}
export function ruleIdentifierToRuleSourceName(identifier) {
    return isGrafanaRuleIdentifier(identifier) ? GRAFANA_RULES_SOURCE_NAME : identifier.ruleSourceName;
}
//# sourceMappingURL=rule-id.js.map