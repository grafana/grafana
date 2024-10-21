import { useMemo } from 'react';

import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { shouldUsePrometheusRulesPrimary } from 'app/features/alerting/unified/featureToggles';
import { CombinedRule, CombinedRuleNamespace } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { getFiltersFromUrlParams } from '../../utils/misc';
import { isAlertingRule } from '../../utils/rules';

import { RuleListStateSection } from './RuleListStateSection';

interface Props {
  namespaces: CombinedRuleNamespace[];
}

type GroupedRules = Record<PromAlertingRuleState, CombinedRule[]>;

// If we're using the Prometheus rules as primary, we leave state sections collapsed by default
// so we defer API calls until the user expands the section
const defaultSectionsToBeCollapsed = shouldUsePrometheusRulesPrimary();

export const RuleListStateView = ({ namespaces }: Props) => {
  const filters = getFiltersFromUrlParams(useQueryParams()[0]);

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
  return (
    <>
      {(!filters.alertState || filters.alertState === PromAlertingRuleState.Firing) && (
        <RuleListStateSection
          defaultCollapsed={defaultSectionsToBeCollapsed}
          state={PromAlertingRuleState.Firing}
          rules={groupedRules[PromAlertingRuleState.Firing]}
        />
      )}
      {(!filters.alertState || filters.alertState === PromAlertingRuleState.Pending) && (
        <RuleListStateSection
          defaultCollapsed={defaultSectionsToBeCollapsed}
          state={PromAlertingRuleState.Pending}
          rules={groupedRules[PromAlertingRuleState.Pending]}
        />
      )}
      {(!filters.alertState || filters.alertState === PromAlertingRuleState.Inactive) && (
        <RuleListStateSection
          defaultCollapsed={defaultSectionsToBeCollapsed || filters.alertState !== PromAlertingRuleState.Inactive}
          state={PromAlertingRuleState.Inactive}
          rules={groupedRules[PromAlertingRuleState.Inactive]}
        />
      )}
    </>
  );
};
