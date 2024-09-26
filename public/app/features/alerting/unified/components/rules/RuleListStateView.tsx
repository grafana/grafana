import { useMemo } from 'react';

import { Counter, Stack } from '@grafana/ui';
import { CombinedRule, CombinedRuleNamespace } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { createViewLink } from '../../utils/misc';
import { hashRule } from '../../utils/rule-id';
import { isAlertingRule } from '../../utils/rules';
import { AlertRuleListItem, Namespace } from '../rule-list/components/components';

interface Props {
  namespaces: CombinedRuleNamespace[];
}

type GroupedRules = Record<PromAlertingRuleState, CombinedRule[]>;

export const RuleListStateView = ({ namespaces }: Props) => {
  const groupedRules = useMemo(() => {
    const result: GroupedRules = {
      [PromAlertingRuleState.Firing]: [],
      [PromAlertingRuleState.Inactive]: [],
      [PromAlertingRuleState.Pending]: [],
    };

    namespaces.forEach((namespace) =>
      namespace.groups.forEach((group) =>
        group.rules.forEach((rule) => {
          // We might hit edge cases where there type = alerting, but there is no state.
          // In this case, we shouldn't try to group these alerts in the state view
          // Even though we handle this at the API layer, this is a last catch point for any edge cases
          if (rule.promRule && isAlertingRule(rule.promRule) && rule.promRule.state) {
            result[rule.promRule.state].push(rule);
          }
        })
      )
    );

    Object.values(result).forEach((rules) => rules.sort((a, b) => a.name.localeCompare(b.name)));

    return result;
  }, [namespaces]);

  const titles: Record<string, string> = {
    [PromAlertingRuleState.Firing]: 'Firing',
    [PromAlertingRuleState.Pending]: 'Pending',
    [PromAlertingRuleState.Inactive]: 'Normal',
  };

  return (
    <Stack direction="column">
      {Object.entries(groupedRules).map(([state, rules]) => (
        <Namespace
          name={
            <Stack alignItems="center" gap={-1}>
              {titles[state] ?? 'Unknown'}
              <Counter value={rules.length} />
            </Stack>
          }
          key={state}
          collapsed={rules.length === 0}
        >
          {rules.map((rule) => (
            <AlertRuleListItem
              key={hashRule(rule.promRule!)}
              state={state}
              name={rule.name}
              error={rule.promRule?.lastError}
              summary={rule.annotations.summary}
              href={createViewLink(rule.namespace.rulesSource, rule)}
              groupName={rule.group.name}
              namespace={rule.namespace}
            />
          ))}
        </Namespace>
      ))}
    </Stack>
  );
};
