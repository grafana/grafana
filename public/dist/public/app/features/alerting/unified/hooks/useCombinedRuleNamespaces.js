import { __rest } from "tslib";
import { countBy, isEqual } from 'lodash';
import { useMemo, useRef } from 'react';
import { AlertInstanceTotalState, } from 'app/types/unified-alerting';
import { PromAlertingRuleState, } from 'app/types/unified-alerting-dto';
import { getAllRulesSources, getRulesSourceByName, GRAFANA_RULES_SOURCE_NAME, isCloudRulesSource, isGrafanaRulesSource, } from '../utils/datasource';
import { isAlertingRule, isAlertingRulerRule, isGrafanaRulerRule, isRecordingRule, isRecordingRulerRule, } from '../utils/rules';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
// this little monster combines prometheus rules and ruler rules to produce a unified data structure
// can limit to a single rules source
export function useCombinedRuleNamespaces(rulesSourceName, grafanaPromRuleNamespaces) {
    const promRulesResponses = useUnifiedAlertingSelector((state) => state.promRules);
    const rulerRulesResponses = useUnifiedAlertingSelector((state) => state.rulerRules);
    // cache results per rules source, so we only recalculate those for which results have actually changed
    const cache = useRef({});
    const rulesSources = useMemo(() => {
        if (rulesSourceName) {
            const rulesSource = getRulesSourceByName(rulesSourceName);
            if (!rulesSource) {
                throw new Error(`Unknown rules source: ${rulesSourceName}`);
            }
            return [rulesSource];
        }
        return getAllRulesSources();
    }, [rulesSourceName]);
    return useMemo(() => {
        return rulesSources
            .map((rulesSource) => {
            var _a, _b;
            const rulesSourceName = isCloudRulesSource(rulesSource) ? rulesSource.name : rulesSource;
            const rulerRules = (_a = rulerRulesResponses[rulesSourceName]) === null || _a === void 0 ? void 0 : _a.result;
            let promRules = (_b = promRulesResponses[rulesSourceName]) === null || _b === void 0 ? void 0 : _b.result;
            if (rulesSourceName === GRAFANA_RULES_SOURCE_NAME && grafanaPromRuleNamespaces) {
                promRules = grafanaPromRuleNamespaces;
            }
            const cached = cache.current[rulesSourceName];
            if (cached && cached.promRules === promRules && cached.rulerRules === rulerRules) {
                return cached.result;
            }
            const namespaces = {};
            // first get all the ruler rules from the data source
            Object.entries(rulerRules || {}).forEach(([namespaceName, groups]) => {
                const namespace = {
                    rulesSource,
                    name: namespaceName,
                    groups: [],
                };
                namespaces[namespaceName] = namespace;
                addRulerGroupsToCombinedNamespace(namespace, groups);
            });
            // then correlate with prometheus rules
            promRules === null || promRules === void 0 ? void 0 : promRules.forEach(({ name: namespaceName, groups }) => {
                const ns = (namespaces[namespaceName] = namespaces[namespaceName] || {
                    rulesSource,
                    name: namespaceName,
                    groups: [],
                });
                addPromGroupsToCombinedNamespace(ns, groups);
            });
            const result = Object.values(namespaces);
            cache.current[rulesSourceName] = { promRules, rulerRules, result };
            return result;
        })
            .flat();
    }, [promRulesResponses, rulerRulesResponses, rulesSources, grafanaPromRuleNamespaces]);
}
export function combineRulesNamespaces(rulesSource, promNamespaces, rulerRules) {
    const namespaces = {};
    // first get all the ruler rules from the data source
    Object.entries(rulerRules || {}).forEach(([namespaceName, groups]) => {
        const namespace = {
            rulesSource,
            name: namespaceName,
            groups: [],
        };
        namespaces[namespaceName] = namespace;
        addRulerGroupsToCombinedNamespace(namespace, groups);
    });
    // then correlate with prometheus rules
    promNamespaces === null || promNamespaces === void 0 ? void 0 : promNamespaces.forEach(({ name: namespaceName, groups }) => {
        const ns = (namespaces[namespaceName] = namespaces[namespaceName] || {
            rulesSource,
            name: namespaceName,
            groups: [],
        });
        addPromGroupsToCombinedNamespace(ns, groups);
    });
    return Object.values(namespaces);
}
export function attachRulerRulesToCombinedRules(rulesSource, promNamespace, rulerGroups) {
    const ns = {
        rulesSource: rulesSource,
        name: promNamespace.name,
        groups: [],
    };
    // The order is important. Adding Ruler rules overrides Prometheus rules.
    addRulerGroupsToCombinedNamespace(ns, rulerGroups);
    addPromGroupsToCombinedNamespace(ns, promNamespace.groups);
    // Remove ruler rules which does not have Prom rule counterpart
    // This function should only attach Ruler rules to existing Prom rules
    ns.groups.forEach((group) => {
        group.rules = group.rules.filter((rule) => rule.promRule);
    });
    return ns;
}
export function addCombinedPromAndRulerGroups(ns, promGroups, rulerGroups) {
    addRulerGroupsToCombinedNamespace(ns, rulerGroups);
    addPromGroupsToCombinedNamespace(ns, promGroups);
    return ns;
}
// merge all groups in case of grafana managed, essentially treating namespaces (folders) as groups
export function flattenGrafanaManagedRules(namespaces) {
    return namespaces.map((namespace) => {
        const newNamespace = Object.assign(Object.assign({}, namespace), { groups: [] });
        // add default group with ungrouped rules
        newNamespace.groups.push({
            name: 'default',
            rules: sortRulesByName(namespace.groups.flatMap((group) => group.rules)),
            totals: calculateAllGroupsTotals(namespace.groups),
        });
        return newNamespace;
    });
}
export function sortRulesByName(rules) {
    return rules.sort((a, b) => a.name.localeCompare(b.name));
}
function addRulerGroupsToCombinedNamespace(namespace, groups = []) {
    namespace.groups = groups.map((group) => {
        const numRecordingRules = group.rules.filter((rule) => isRecordingRulerRule(rule)).length;
        const numPaused = group.rules.filter((rule) => isGrafanaRulerRule(rule) && rule.grafana_alert.is_paused).length;
        const combinedGroup = {
            name: group.name,
            interval: group.interval,
            source_tenants: group.source_tenants,
            rules: [],
            totals: {
                paused: numPaused,
                recording: numRecordingRules,
            },
        };
        combinedGroup.rules = group.rules.map((rule) => rulerRuleToCombinedRule(rule, namespace, combinedGroup));
        return combinedGroup;
    });
}
function addPromGroupsToCombinedNamespace(namespace, groups) {
    const existingGroupsByName = new Map();
    namespace.groups.forEach((group) => existingGroupsByName.set(group.name, group));
    groups.forEach((group) => {
        var _a;
        let combinedGroup = existingGroupsByName.get(group.name);
        if (!combinedGroup) {
            combinedGroup = {
                name: group.name,
                rules: [],
                totals: calculateGroupTotals(group),
            };
            namespace.groups.push(combinedGroup);
            existingGroupsByName.set(group.name, combinedGroup);
        }
        // combine totals from ruler with totals from prometheus state API
        combinedGroup.totals = Object.assign(Object.assign({}, combinedGroup.totals), calculateGroupTotals(group));
        const combinedRulesByName = new Map();
        combinedGroup.rules.forEach((r) => {
            // Prometheus rules do not have to be unique by name
            const existingRule = combinedRulesByName.get(r.name);
            existingRule ? existingRule.push(r) : combinedRulesByName.set(r.name, [r]);
        });
        ((_a = group.rules) !== null && _a !== void 0 ? _a : []).forEach((rule) => {
            const existingRule = getExistingRuleInGroup(rule, combinedRulesByName, namespace.rulesSource);
            if (existingRule) {
                existingRule.promRule = rule;
                existingRule.instanceTotals = isAlertingRule(rule) ? calculateRuleTotals(rule) : {};
                existingRule.filteredInstanceTotals = isAlertingRule(rule) ? calculateRuleFilteredTotals(rule) : {};
            }
            else {
                combinedGroup.rules.push(promRuleToCombinedRule(rule, namespace, combinedGroup));
            }
        });
    });
}
export function calculateRuleTotals(rule) {
    const result = countBy(rule.alerts, 'state');
    if (rule.totals) {
        const _a = rule.totals, { normal } = _a, totals = __rest(_a, ["normal"]);
        return Object.assign(Object.assign({}, totals), { inactive: normal });
    }
    return {
        alerting: result[AlertInstanceTotalState.Alerting],
        pending: result[AlertInstanceTotalState.Pending],
        inactive: result[AlertInstanceTotalState.Normal],
        nodata: result[AlertInstanceTotalState.NoData],
        error: result[AlertInstanceTotalState.Error] + result['err'], // Prometheus uses "err" instead of "error"
    };
}
export function calculateRuleFilteredTotals(rule) {
    if (rule.totalsFiltered) {
        const _a = rule.totalsFiltered, { normal } = _a, totals = __rest(_a, ["normal"]);
        return Object.assign(Object.assign({}, totals), { inactive: normal });
    }
    return {};
}
export function calculateGroupTotals(group) {
    if (group.totals) {
        const _a = group.totals, { firing } = _a, totals = __rest(_a, ["firing"]);
        return Object.assign(Object.assign({}, totals), { alerting: firing });
    }
    const countsByState = countBy(group.rules, (rule) => isAlertingRule(rule) && rule.state);
    const countsByHealth = countBy(group.rules, (rule) => rule.health);
    const recordingCount = group.rules.filter((rule) => isRecordingRule(rule)).length;
    return {
        alerting: countsByState[PromAlertingRuleState.Firing],
        error: countsByHealth.error,
        nodata: countsByHealth.nodata,
        inactive: countsByState[PromAlertingRuleState.Inactive],
        pending: countsByState[PromAlertingRuleState.Pending],
        recording: recordingCount,
    };
}
function calculateAllGroupsTotals(groups) {
    const totals = {};
    groups.forEach((group) => {
        const groupTotals = group.totals;
        Object.entries(groupTotals).forEach(([key, value]) => {
            if (!totals[key]) {
                totals[key] = 0;
            }
            totals[key] += value;
        });
    });
    return totals;
}
function promRuleToCombinedRule(rule, namespace, group) {
    return {
        name: rule.name,
        query: rule.query,
        labels: rule.labels || {},
        annotations: isAlertingRule(rule) ? rule.annotations || {} : {},
        promRule: rule,
        namespace: namespace,
        group,
        instanceTotals: isAlertingRule(rule) ? calculateRuleTotals(rule) : {},
        filteredInstanceTotals: isAlertingRule(rule) ? calculateRuleFilteredTotals(rule) : {},
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
            namespace,
            group,
            instanceTotals: {},
            filteredInstanceTotals: {},
        }
        : isRecordingRulerRule(rule)
            ? {
                name: rule.record,
                query: rule.expr,
                labels: rule.labels || {},
                annotations: {},
                rulerRule: rule,
                namespace,
                group,
                instanceTotals: {},
                filteredInstanceTotals: {},
            }
            : {
                name: rule.grafana_alert.title,
                query: '',
                labels: rule.labels || {},
                annotations: rule.annotations || {},
                rulerRule: rule,
                namespace,
                group,
                instanceTotals: {},
                filteredInstanceTotals: {},
            };
}
// find existing rule in group that matches the given prom rule
function getExistingRuleInGroup(rule, existingCombinedRulesMap, rulesSource) {
    // Using Map of name-based rules is important performance optimization for the code below
    // Otherwise we would perform find method multiple times on (possibly) thousands of rules
    const nameMatchingRules = existingCombinedRulesMap.get(rule.name);
    if (!nameMatchingRules) {
        return undefined;
    }
    if (isGrafanaRulesSource(rulesSource)) {
        // assume grafana groups have only the one rule. check name anyway because paranoid
        return nameMatchingRules[0];
    }
    // try finding a rule that matches name, labels, annotations and query
    const strictlyMatchingRule = nameMatchingRules.find((combinedRule) => !combinedRule.promRule && isCombinedRuleEqualToPromRule(combinedRule, rule, true));
    if (strictlyMatchingRule) {
        return strictlyMatchingRule;
    }
    // if that fails, try finding a rule that only matches name, labels and annotations.
    // loki & prom can sometimes modify the query so it doesnt match, eg `2 > 1` becomes `1`
    const looselyMatchingRule = nameMatchingRules.find((combinedRule) => !combinedRule.promRule && isCombinedRuleEqualToPromRule(combinedRule, rule, false));
    if (looselyMatchingRule) {
        return looselyMatchingRule;
    }
    return undefined;
}
function isCombinedRuleEqualToPromRule(combinedRule, rule, checkQuery = true) {
    if (combinedRule.name === rule.name) {
        return isEqual([checkQuery ? hashQuery(combinedRule.query) : '', combinedRule.labels, combinedRule.annotations], [checkQuery ? hashQuery(rule.query) : '', rule.labels || {}, isAlertingRule(rule) ? rule.annotations || {} : {}]);
    }
    return false;
}
// there can be slight differences in how prom & ruler render a query, this will hash them accounting for the differences
function hashQuery(query) {
    // one of them might be wrapped in parens
    if (query.length > 1 && query[0] === '(' && query[query.length - 1] === ')') {
        query = query.slice(1, -1);
    }
    // whitespace could be added or removed
    query = query.replace(/\s|\n/g, '');
    // labels matchers can be reordered, so sort the enitre string, esentially comparing just the character counts
    return query.split('').sort().join('');
}
//# sourceMappingURL=useCombinedRuleNamespaces.js.map