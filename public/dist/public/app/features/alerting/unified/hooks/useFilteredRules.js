import { __assign, __read } from "tslib";
import { useMemo } from 'react';
import { isCloudRulesSource } from '../utils/datasource';
import { isAlertingRule, isGrafanaRulerRule } from '../utils/rules';
import { getFiltersFromUrlParams } from '../utils/misc';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { PromRuleType } from 'app/types/unified-alerting-dto';
import { getDataSourceSrv } from '@grafana/runtime';
import { labelsMatchMatchers, parseMatchers } from '../utils/alertmanager';
export var useFilteredRules = function (namespaces) {
    var _a = __read(useQueryParams(), 1), queryParams = _a[0];
    var filters = getFiltersFromUrlParams(queryParams);
    return useMemo(function () {
        var filteredNamespaces = namespaces
            // Filter by data source
            // TODO: filter by multiple data sources for grafana-managed alerts
            .filter(function (_a) {
            var rulesSource = _a.rulesSource;
            return filters.dataSource && isCloudRulesSource(rulesSource) ? rulesSource.name === filters.dataSource : true;
        })
            // If a namespace and group have rules that match the rules filters then keep them.
            .reduce(reduceNamespaces(filters), []);
        return filteredNamespaces;
    }, [namespaces, filters]);
};
var reduceNamespaces = function (filters) {
    return function (namespaceAcc, namespace) {
        var groups = namespace.groups.reduce(reduceGroups(filters), []);
        if (groups.length) {
            namespaceAcc.push(__assign(__assign({}, namespace), { groups: groups }));
        }
        return namespaceAcc;
    };
};
// Reduces groups to only groups that have rules matching the filters
var reduceGroups = function (filters) {
    return function (groupAcc, group) {
        var rules = group.rules.filter(function (rule) {
            var _a, _b;
            if (filters.ruleType && filters.ruleType !== ((_a = rule.promRule) === null || _a === void 0 ? void 0 : _a.type)) {
                return false;
            }
            if (filters.dataSource && isGrafanaRulerRule(rule.rulerRule) && !isQueryingDataSource(rule.rulerRule, filters)) {
                return false;
            }
            // Query strings can match alert name, label keys, and label values
            if (filters.queryString) {
                var normalizedQueryString = filters.queryString.toLocaleLowerCase();
                var doesNameContainsQueryString = (_b = rule.name) === null || _b === void 0 ? void 0 : _b.toLocaleLowerCase().includes(normalizedQueryString);
                var matchers_1 = parseMatchers(filters.queryString);
                var doRuleLabelsMatchQuery = labelsMatchMatchers(rule.labels, matchers_1);
                var doAlertsContainMatchingLabels = rule.promRule &&
                    rule.promRule.type === PromRuleType.Alerting &&
                    rule.promRule.alerts &&
                    rule.promRule.alerts.some(function (alert) { return labelsMatchMatchers(alert.labels, matchers_1); });
                if (!(doesNameContainsQueryString || doRuleLabelsMatchQuery || doAlertsContainMatchingLabels)) {
                    return false;
                }
            }
            if (filters.alertState &&
                !(rule.promRule && isAlertingRule(rule.promRule) && rule.promRule.state === filters.alertState)) {
                return false;
            }
            return true;
        });
        // Add rules to the group that match the rule list filters
        if (rules.length) {
            groupAcc.push(__assign(__assign({}, group), { rules: rules }));
        }
        return groupAcc;
    };
};
var isQueryingDataSource = function (rulerRule, filter) {
    if (!filter.dataSource) {
        return true;
    }
    return !!rulerRule.grafana_alert.data.find(function (query) {
        if (!query.datasourceUid) {
            return false;
        }
        var ds = getDataSourceSrv().getInstanceSettings(query.datasourceUid);
        return (ds === null || ds === void 0 ? void 0 : ds.name) === filter.dataSource;
    });
};
//# sourceMappingURL=useFilteredRules.js.map