import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import React, { useMemo } from 'react';
import { getFiltersFromUrlParams } from '../../utils/misc';
import { isAlertingRule } from '../../utils/rules';
import { RuleListStateSection } from './RuleListStateSection';
export var RuleListStateView = function (_a) {
    var namespaces = _a.namespaces;
    var filters = getFiltersFromUrlParams(useQueryParams()[0]);
    var groupedRules = useMemo(function () {
        var _a;
        var result = (_a = {},
            _a[PromAlertingRuleState.Firing] = [],
            _a[PromAlertingRuleState.Inactive] = [],
            _a[PromAlertingRuleState.Pending] = [],
            _a);
        namespaces.forEach(function (namespace) {
            return namespace.groups.forEach(function (group) {
                return group.rules.forEach(function (rule) {
                    if (rule.promRule && isAlertingRule(rule.promRule)) {
                        result[rule.promRule.state].push(rule);
                    }
                });
            });
        });
        Object.values(result).forEach(function (rules) { return rules.sort(function (a, b) { return a.name.localeCompare(b.name); }); });
        return result;
    }, [namespaces]);
    return (React.createElement(React.Fragment, null,
        (!filters.alertState || filters.alertState === PromAlertingRuleState.Firing) && (React.createElement(RuleListStateSection, { state: PromAlertingRuleState.Firing, rules: groupedRules[PromAlertingRuleState.Firing] })),
        (!filters.alertState || filters.alertState === PromAlertingRuleState.Pending) && (React.createElement(RuleListStateSection, { state: PromAlertingRuleState.Pending, rules: groupedRules[PromAlertingRuleState.Pending] })),
        (!filters.alertState || filters.alertState === PromAlertingRuleState.Inactive) && (React.createElement(RuleListStateSection, { defaultCollapsed: filters.alertState !== PromAlertingRuleState.Inactive, state: PromAlertingRuleState.Inactive, rules: groupedRules[PromAlertingRuleState.Inactive] }))));
};
//# sourceMappingURL=RuleListStateView.js.map