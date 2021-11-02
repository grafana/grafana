import { __read } from "tslib";
import { useMemo, useRef } from 'react';
import { getAllRulesSources, getRulesSourceByName, isCloudRulesSource, isGrafanaRulesSource, } from '../utils/datasource';
import { isAlertingRule, isAlertingRulerRule, isRecordingRulerRule } from '../utils/rules';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
// this little monster combines prometheus rules and ruler rules to produce a unified data structure
// can limit to a single rules source
export function useCombinedRuleNamespaces(rulesSourceName) {
    var promRulesResponses = useUnifiedAlertingSelector(function (state) { return state.promRules; });
    var rulerRulesResponses = useUnifiedAlertingSelector(function (state) { return state.rulerRules; });
    // cache results per rules source, so we only recalculate those for which results have actually changed
    var cache = useRef({});
    var rulesSources = useMemo(function () {
        if (rulesSourceName) {
            var rulesSource = getRulesSourceByName(rulesSourceName);
            if (!rulesSource) {
                throw new Error("Unknown rules source: " + rulesSourceName);
            }
            return [rulesSource];
        }
        return getAllRulesSources();
    }, [rulesSourceName]);
    return useMemo(function () {
        return rulesSources
            .map(function (rulesSource) {
            var _a, _b;
            var rulesSourceName = isCloudRulesSource(rulesSource) ? rulesSource.name : rulesSource;
            var promRules = (_a = promRulesResponses[rulesSourceName]) === null || _a === void 0 ? void 0 : _a.result;
            var rulerRules = (_b = rulerRulesResponses[rulesSourceName]) === null || _b === void 0 ? void 0 : _b.result;
            var cached = cache.current[rulesSourceName];
            if (cached && cached.promRules === promRules && cached.rulerRules === rulerRules) {
                return cached.result;
            }
            var namespaces = {};
            // first get all the ruler rules in
            Object.entries(rulerRules || {}).forEach(function (_a) {
                var _b = __read(_a, 2), namespaceName = _b[0], groups = _b[1];
                var namespace = {
                    rulesSource: rulesSource,
                    name: namespaceName,
                    groups: [],
                };
                namespaces[namespaceName] = namespace;
                addRulerGroupsToCombinedNamespace(namespace, groups);
            });
            // then correlate with prometheus rules
            promRules === null || promRules === void 0 ? void 0 : promRules.forEach(function (_a) {
                var namespaceName = _a.name, groups = _a.groups;
                var ns = (namespaces[namespaceName] = namespaces[namespaceName] || {
                    rulesSource: rulesSource,
                    name: namespaceName,
                    groups: [],
                });
                addPromGroupsToCombinedNamespace(ns, groups);
            });
            var result = Object.values(namespaces);
            if (isGrafanaRulesSource(rulesSource)) {
                // merge all groups in case of grafana managed, essentially treating namespaces (folders) as gorups
                result.forEach(function (namespace) {
                    namespace.groups = [
                        {
                            name: 'default',
                            rules: namespace.groups.flatMap(function (g) { return g.rules; }).sort(function (a, b) { return a.name.localeCompare(b.name); }),
                        },
                    ];
                });
            }
            cache.current[rulesSourceName] = { promRules: promRules, rulerRules: rulerRules, result: result };
            return result;
        })
            .flat();
    }, [promRulesResponses, rulerRulesResponses, rulesSources]);
}
function addRulerGroupsToCombinedNamespace(namespace, groups) {
    namespace.groups = groups.map(function (group) {
        var combinedGroup = {
            name: group.name,
            interval: group.interval,
            rules: [],
        };
        combinedGroup.rules = group.rules.map(function (rule) { return rulerRuleToCombinedRule(rule, namespace, combinedGroup); });
        return combinedGroup;
    });
}
function addPromGroupsToCombinedNamespace(namespace, groups) {
    groups.forEach(function (group) {
        var _a;
        var combinedGroup = namespace.groups.find(function (g) { return g.name === group.name; });
        if (!combinedGroup) {
            combinedGroup = {
                name: group.name,
                rules: [],
            };
            namespace.groups.push(combinedGroup);
        }
        ((_a = group.rules) !== null && _a !== void 0 ? _a : []).forEach(function (rule) {
            var existingRule = getExistingRuleInGroup(rule, combinedGroup, namespace.rulesSource);
            if (existingRule) {
                existingRule.promRule = rule;
            }
            else {
                combinedGroup.rules.push(promRuleToCombinedRule(rule, namespace, combinedGroup));
            }
        });
    });
}
function promRuleToCombinedRule(rule, namespace, group) {
    return {
        name: rule.name,
        query: rule.query,
        labels: rule.labels || {},
        annotations: isAlertingRule(rule) ? rule.annotations || {} : {},
        promRule: rule,
        namespace: namespace,
        group: group,
    };
}
function rulerRuleToCombinedRule(rule, namespace, group) {
    return isAlertingRulerRule(rule)
        ? {
            name: rule.alert,
            query: rule.expr,
            labels: rule.labels || {},
            annotations: rule.annotations || {},
            rulerRule: rule,
            namespace: namespace,
            group: group,
        }
        : isRecordingRulerRule(rule)
            ? {
                name: rule.record,
                query: rule.expr,
                labels: rule.labels || {},
                annotations: {},
                rulerRule: rule,
                namespace: namespace,
                group: group,
            }
            : {
                name: rule.grafana_alert.title,
                query: '',
                labels: rule.labels || {},
                annotations: rule.annotations || {},
                rulerRule: rule,
                namespace: namespace,
                group: group,
            };
}
// find existing rule in group that matches the given prom rule
function getExistingRuleInGroup(rule, group, rulesSource) {
    var _a;
    if (isGrafanaRulesSource(rulesSource)) {
        // assume grafana groups have only the one rule. check name anyway because paranoid
        return group.rules.find(function (existingRule) { return existingRule.name === rule.name; });
    }
    return (
    // try finding a rule that matches name, labels, annotations and query
    (_a = group.rules.find(function (existingRule) { return !existingRule.promRule && isCombinedRuleEqualToPromRule(existingRule, rule, true); })) !== null && _a !== void 0 ? _a : 
    // if that fails, try finding a rule that only matches name, labels and annotations.
    // loki & prom can sometimes modify the query so it doesnt match, eg `2 > 1` becomes `1`
    group.rules.find(function (existingRule) { return !existingRule.promRule && isCombinedRuleEqualToPromRule(existingRule, rule, false); }));
}
function isCombinedRuleEqualToPromRule(combinedRule, rule, checkQuery) {
    if (checkQuery === void 0) { checkQuery = true; }
    if (combinedRule.name === rule.name) {
        return (JSON.stringify([
            checkQuery ? hashQuery(combinedRule.query) : '',
            combinedRule.labels,
            combinedRule.annotations,
        ]) ===
            JSON.stringify([
                checkQuery ? hashQuery(rule.query) : '',
                rule.labels || {},
                isAlertingRule(rule) ? rule.annotations || {} : {},
            ]));
    }
    return false;
}
// there can be slight differences in how prom & ruler render a query, this will hash them accounting for the differences
function hashQuery(query) {
    // one of them might be wrapped in parens
    if (query.length > 1 && query[0] === '(' && query[query.length - 1] === ')') {
        query = query.substr(1, query.length - 2);
    }
    // whitespace could be added or removed
    query = query.replace(/\s|\n/g, '');
    // labels matchers can be reordered, so sort the enitre string, esentially comparing just the character counts
    return query.split('').sort().join('');
}
//# sourceMappingURL=useCombinedRuleNamespaces.js.map