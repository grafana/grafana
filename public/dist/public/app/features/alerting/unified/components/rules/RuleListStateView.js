import React, { useMemo } from 'react';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { getFiltersFromUrlParams } from '../../utils/misc';
import { isAlertingRule } from '../../utils/rules';
import { RuleListStateSection } from './RuleListStateSection';
export const RuleListStateView = ({ namespaces }) => {
    const filters = getFiltersFromUrlParams(useQueryParams()[0]);
    const groupedRules = useMemo(() => {
        const result = {
            [PromAlertingRuleState.Firing]: [],
            [PromAlertingRuleState.Inactive]: [],
            [PromAlertingRuleState.Pending]: [],
        };
        namespaces.forEach((namespace) => namespace.groups.forEach((group) => group.rules.forEach((rule) => {
            if (rule.promRule && isAlertingRule(rule.promRule)) {
                result[rule.promRule.state].push(rule);
            }
        })));
        Object.values(result).forEach((rules) => rules.sort((a, b) => a.name.localeCompare(b.name)));
        return result;
    }, [namespaces]);
    return (React.createElement(React.Fragment, null,
        (!filters.alertState || filters.alertState === PromAlertingRuleState.Firing) && (React.createElement(RuleListStateSection, { state: PromAlertingRuleState.Firing, rules: groupedRules[PromAlertingRuleState.Firing] })),
        (!filters.alertState || filters.alertState === PromAlertingRuleState.Pending) && (React.createElement(RuleListStateSection, { state: PromAlertingRuleState.Pending, rules: groupedRules[PromAlertingRuleState.Pending] })),
        (!filters.alertState || filters.alertState === PromAlertingRuleState.Inactive) && (React.createElement(RuleListStateSection, { defaultCollapsed: filters.alertState !== PromAlertingRuleState.Inactive, state: PromAlertingRuleState.Inactive, rules: groupedRules[PromAlertingRuleState.Inactive] }))));
};
//# sourceMappingURL=RuleListStateView.js.map