import uFuzzy from '@leeoniya/ufuzzy';
import { produce } from 'immer';
import { compact, isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo } from 'react';
import { getDataSourceSrv } from '@grafana/runtime';
import { isPromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';
import { applySearchFilterToQuery, getSearchFilterFromQuery } from '../search/rulesSearchParser';
import { labelsMatchMatchers, matcherToMatcherField, parseMatchers } from '../utils/alertmanager';
import { isCloudRulesSource } from '../utils/datasource';
import { parseMatcher } from '../utils/matchers';
import { getRuleHealth, isAlertingRule, isGrafanaRulerRule, isPromRuleType } from '../utils/rules';
import { calculateGroupTotals, calculateRuleFilteredTotals, calculateRuleTotals } from './useCombinedRuleNamespaces';
import { useURLSearchParams } from './useURLSearchParams';
export function useRulesFilter() {
    var _a;
    const [queryParams, updateQueryParams] = useURLSearchParams();
    const searchQuery = (_a = queryParams.get('search')) !== null && _a !== void 0 ? _a : '';
    const filterState = useMemo(() => getSearchFilterFromQuery(searchQuery), [searchQuery]);
    const hasActiveFilters = useMemo(() => Object.values(filterState).some((filter) => !isEmpty(filter)), [filterState]);
    const updateFilters = useCallback((newFilter) => {
        const newSearchQuery = applySearchFilterToQuery(searchQuery, newFilter);
        updateQueryParams({ search: newSearchQuery });
    }, [searchQuery, updateQueryParams]);
    const setSearchQuery = useCallback((newSearchQuery) => {
        updateQueryParams({ search: newSearchQuery });
    }, [updateQueryParams]);
    // Handle legacy filters
    useEffect(() => {
        var _a, _b, _c, _d;
        const legacyFilters = {
            dataSource: (_a = queryParams.get('dataSource')) !== null && _a !== void 0 ? _a : undefined,
            alertState: (_b = queryParams.get('alertState')) !== null && _b !== void 0 ? _b : undefined,
            ruleType: (_c = queryParams.get('ruleType')) !== null && _c !== void 0 ? _c : undefined,
            labels: parseMatchers((_d = queryParams.get('queryString')) !== null && _d !== void 0 ? _d : '').map(matcherToMatcherField),
        };
        const hasLegacyFilters = Object.values(legacyFilters).some((legacyFilter) => !isEmpty(legacyFilter));
        if (hasLegacyFilters) {
            updateQueryParams({ dataSource: undefined, alertState: undefined, ruleType: undefined, queryString: undefined });
            // Existing query filters takes precedence over legacy ones
            updateFilters(produce(filterState, (draft) => {
                var _a, _b, _c;
                (_a = draft.dataSourceNames) !== null && _a !== void 0 ? _a : (draft.dataSourceNames = legacyFilters.dataSource ? [legacyFilters.dataSource] : []);
                if (legacyFilters.alertState && isPromAlertingRuleState(legacyFilters.alertState)) {
                    (_b = draft.ruleState) !== null && _b !== void 0 ? _b : (draft.ruleState = legacyFilters.alertState);
                }
                if (legacyFilters.ruleType && isPromRuleType(legacyFilters.ruleType)) {
                    (_c = draft.ruleType) !== null && _c !== void 0 ? _c : (draft.ruleType = legacyFilters.ruleType);
                }
                if (draft.labels.length === 0 && legacyFilters.labels.length > 0) {
                    const legacyLabelsAsStrings = legacyFilters.labels.map(({ name, operator, value }) => `${name}${operator}${value}`);
                    draft.labels.push(...legacyLabelsAsStrings);
                }
            }));
        }
    }, [queryParams, updateFilters, filterState, updateQueryParams]);
    return { filterState, hasActiveFilters, searchQuery, setSearchQuery, updateFilters };
}
export const useFilteredRules = (namespaces, filterState) => {
    return useMemo(() => {
        const filteredRules = filterRules(namespaces, filterState);
        // Totals recalculation is a workaround for the lack of server-side filtering
        filteredRules.forEach((namespace) => {
            namespace.groups.forEach((group) => {
                group.rules.forEach((rule) => {
                    if (isAlertingRule(rule.promRule)) {
                        rule.instanceTotals = calculateRuleTotals(rule.promRule);
                        rule.filteredInstanceTotals = calculateRuleFilteredTotals(rule.promRule);
                    }
                });
                group.totals = calculateGroupTotals({
                    rules: group.rules.map((r) => r.promRule).filter((r) => !!r),
                });
            });
        });
        return filteredRules;
    }, [namespaces, filterState]);
};
// Options details can be found here https://github.com/leeoniya/uFuzzy#options
// The following configuration complies with Damerau-Levenshtein distance
// https://en.wikipedia.org/wiki/Damerau%E2%80%93Levenshtein_distance
const ufuzzy = new uFuzzy({
    intraMode: 1,
    intraIns: 1,
    intraSub: 1,
    intraTrn: 1,
    intraDel: 1,
});
export const filterRules = (namespaces, filterState = { dataSourceNames: [], labels: [], freeFormWords: [] }) => {
    let filteredNamespaces = namespaces;
    const dataSourceFilter = filterState.dataSourceNames;
    if (dataSourceFilter.length) {
        filteredNamespaces = filteredNamespaces.filter(({ rulesSource }) => isCloudRulesSource(rulesSource) ? dataSourceFilter.includes(rulesSource.name) : true);
    }
    const namespaceFilter = filterState.namespace;
    if (namespaceFilter) {
        const namespaceHaystack = filteredNamespaces.map((ns) => ns.name);
        const [idxs, info, order] = ufuzzy.search(namespaceHaystack, namespaceFilter);
        if (info && order) {
            filteredNamespaces = order.map((idx) => filteredNamespaces[info.idx[idx]]);
        }
        else if (idxs) {
            filteredNamespaces = idxs.map((idx) => filteredNamespaces[idx]);
        }
    }
    // If a namespace and group have rules that match the rules filters then keep them.
    return filteredNamespaces.reduce(reduceNamespaces(filterState), []);
};
const reduceNamespaces = (filterState) => {
    return (namespaceAcc, namespace) => {
        const groupNameFilter = filterState.groupName;
        let filteredGroups = namespace.groups;
        if (groupNameFilter) {
            const groupsHaystack = filteredGroups.map((g) => g.name);
            const [idxs, info, order] = ufuzzy.search(groupsHaystack, groupNameFilter);
            if (info && order) {
                filteredGroups = order.map((idx) => filteredGroups[info.idx[idx]]);
            }
            else if (idxs) {
                filteredGroups = idxs.map((idx) => filteredGroups[idx]);
            }
        }
        filteredGroups = filteredGroups.reduce(reduceGroups(filterState), []);
        if (filteredGroups.length) {
            namespaceAcc.push(Object.assign(Object.assign({}, namespace), { groups: filteredGroups }));
        }
        return namespaceAcc;
    };
};
// Reduces groups to only groups that have rules matching the filters
const reduceGroups = (filterState) => {
    var _a;
    const ruleNameQuery = (_a = filterState.ruleName) !== null && _a !== void 0 ? _a : filterState.freeFormWords.join(' ');
    return (groupAcc, group) => {
        let filteredRules = group.rules;
        if (ruleNameQuery) {
            const rulesHaystack = filteredRules.map((r) => r.name);
            const [idxs, info, order] = ufuzzy.search(rulesHaystack, ruleNameQuery);
            if (info && order) {
                filteredRules = order.map((idx) => filteredRules[info.idx[idx]]);
            }
            else if (idxs) {
                filteredRules = idxs.map((idx) => filteredRules[idx]);
            }
        }
        filteredRules = filteredRules.filter((rule) => {
            var _a, _b;
            if (filterState.ruleType && filterState.ruleType !== ((_a = rule.promRule) === null || _a === void 0 ? void 0 : _a.type)) {
                return false;
            }
            const doesNotQueryDs = isGrafanaRulerRule(rule.rulerRule) && !isQueryingDataSource(rule.rulerRule, filterState);
            if (((_b = filterState.dataSourceNames) === null || _b === void 0 ? void 0 : _b.length) && doesNotQueryDs) {
                return false;
            }
            if (filterState.ruleHealth && rule.promRule) {
                const ruleHealth = getRuleHealth(rule.promRule.health);
                return filterState.ruleHealth === ruleHealth;
            }
            // Query strings can match alert name, label keys, and label values
            if (filterState.labels.length > 0) {
                // const matchers = parseMatchers(filters.queryString);
                const matchers = compact(filterState.labels.map(looseParseMatcher));
                const doRuleLabelsMatchQuery = matchers.length > 0 && labelsMatchMatchers(rule.labels, matchers);
                const doAlertsContainMatchingLabels = matchers.length > 0 &&
                    rule.promRule &&
                    rule.promRule.type === PromRuleType.Alerting &&
                    rule.promRule.alerts &&
                    rule.promRule.alerts.some((alert) => labelsMatchMatchers(alert.labels, matchers));
                if (!(doRuleLabelsMatchQuery || doAlertsContainMatchingLabels)) {
                    return false;
                }
            }
            if (filterState.ruleState &&
                !(rule.promRule && isAlertingRule(rule.promRule) && rule.promRule.state === filterState.ruleState)) {
                return false;
            }
            return true;
        });
        // Add rules to the group that match the rule list filters
        if (filteredRules.length) {
            groupAcc.push(Object.assign(Object.assign({}, group), { rules: filteredRules }));
        }
        return groupAcc;
    };
};
function looseParseMatcher(matcherQuery) {
    try {
        return parseMatcher(matcherQuery);
    }
    catch (_a) {
        // Try to createa a matcher than matches all values for a given key
        return { name: matcherQuery, value: '', isRegex: true, isEqual: true };
    }
}
const isQueryingDataSource = (rulerRule, filterState) => {
    var _a;
    if (!((_a = filterState.dataSourceNames) === null || _a === void 0 ? void 0 : _a.length)) {
        return true;
    }
    return !!rulerRule.grafana_alert.data.find((query) => {
        var _a;
        if (!query.datasourceUid) {
            return false;
        }
        const ds = getDataSourceSrv().getInstanceSettings(query.datasourceUid);
        return (ds === null || ds === void 0 ? void 0 : ds.name) && ((_a = filterState === null || filterState === void 0 ? void 0 : filterState.dataSourceNames) === null || _a === void 0 ? void 0 : _a.includes(ds.name));
    });
};
//# sourceMappingURL=useFilteredRules.js.map