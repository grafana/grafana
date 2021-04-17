import { CombinedRule, CombinedRuleNamespace } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import React, { FC, useMemo } from 'react';
import { isAlertingRule } from '../../utils/rules';
import { RuleListStateSection } from './RuleListSateSection';

interface Props {
  namespaces: CombinedRuleNamespace[];
}

type GroupedRules = Record<PromAlertingRuleState, CombinedRule[]>;

export const RuleListStateView: FC<Props> = ({ namespaces }) => {
  const groupedRules = useMemo(() => {
    const result: GroupedRules = {
      [PromAlertingRuleState.Firing]: [],
      [PromAlertingRuleState.Inactive]: [],
      [PromAlertingRuleState.Pending]: [],
    };

    namespaces.forEach((namespace) =>
      namespace.groups.forEach((group) =>
        group.rules.forEach((rule) => {
          if (rule.promRule && isAlertingRule(rule.promRule)) {
            result[rule.promRule.state].push(rule);
          }
        })
      )
    );

    Object.values(result).forEach((rules) => rules.sort((a, b) => a.name.localeCompare(b.name)));

    return result;
  }, [namespaces]);
  return (
    <>
      <RuleListStateSection state={PromAlertingRuleState.Firing} rules={groupedRules[PromAlertingRuleState.Firing]} />
      <RuleListStateSection state={PromAlertingRuleState.Pending} rules={groupedRules[PromAlertingRuleState.Pending]} />
      <RuleListStateSection
        defaultCollapsed={true}
        state={PromAlertingRuleState.Inactive}
        rules={groupedRules[PromAlertingRuleState.Inactive]}
      />
    </>
  );
};
