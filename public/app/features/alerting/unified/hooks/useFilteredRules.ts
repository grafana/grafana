import { useMemo } from 'react';

import { CombinedRuleGroup, CombinedRuleNamespace } from 'app/types/unified-alerting';
import { isCloudRulesSource } from '../utils/datasource';
import { isAlertingRule } from '../utils/rules';
import { getFiltersFromUrlParams } from '../utils/misc';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

export const useFilteredRules = (namespaces: CombinedRuleNamespace[]) => {
  const [queryParams] = useQueryParams();
  const filters = getFiltersFromUrlParams(queryParams);

  return useMemo(() => {
    const filteredNamespaces = namespaces
      // Filter by data source
      // TODO: filter by multiple data sources for grafana-managed alerts
      .filter(({ rulesSource }) =>
        filters.dataSource && isCloudRulesSource(rulesSource) ? rulesSource.name === filters.dataSource : true
      )
      // If a namespace and group have rules that match the rules filters then keep them.
      .reduce((namespaceAcc, namespace) => {
        const { groups } = namespace;
        const filteredGroups = groups.reduce((groupAcc, group) => {
          const groupCopy = { ...group };
          const rules = groupCopy.rules.filter((rule) => {
            let shouldKeep = true;
            // Query strings can match alert name, label keys, and label values
            if (filters.queryString) {
              const normalizedQueryString = filters.queryString.toLocaleLowerCase();
              const doesNameContainsQueryString = rule.name.toLocaleLowerCase().includes(normalizedQueryString);

              const doLabelsContainQueryString = Object.entries(rule.labels || {}).some(
                ([key, value]) =>
                  key.toLocaleLowerCase().includes(normalizedQueryString) ||
                  value.toLocaleLowerCase().includes(normalizedQueryString)
              );
              shouldKeep = doesNameContainsQueryString || doLabelsContainQueryString;
            }
            if (filters.alertState) {
              const matchesAlertState = Boolean(
                rule.promRule && isAlertingRule(rule.promRule) && rule.promRule.state === filters.alertState
              );

              shouldKeep = shouldKeep && matchesAlertState;
            }
            return shouldKeep;
          });
          // Add rules to the group that match the rule list filters
          if (rules.length) {
            groupCopy.rules = rules;
            groupAcc.push(groupCopy);
          }
          return groupAcc;
        }, [] as CombinedRuleGroup[]);

        if (filteredGroups.length) {
          namespace.groups = filteredGroups;
          namespaceAcc.push(namespace);
        }

        return namespaceAcc;
      }, [] as CombinedRuleNamespace[]);
    return filteredNamespaces;
  }, [filters.alertState, filters.queryString, filters.dataSource, namespaces]);
};
