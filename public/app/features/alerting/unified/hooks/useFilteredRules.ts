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
      .filter(({ rulesSource }) =>
        filters.dataSource && isCloudRulesSource(rulesSource) ? rulesSource.name === filters.dataSource : true
      )
      .reduce((acc, namespace) => {
        const { groups } = namespace;
        const filteredGroups = groups.reduce((groupAcc, group) => {
          const groupCopy = { ...group };
          const rules = groupCopy.rules.filter((rule) => {
            let shouldKeep = true;
            if (filters.queryString) {
              const normalizedQueryString = filters.queryString.toLocaleLowerCase();
              const doesNameContainsQueryString = rule.name.toLocaleLowerCase().includes(normalizedQueryString);

              const doLabelsContainQueryString = Object.entries(rule.labels || {}).find(
                ([key, value]) =>
                  key.toLocaleLowerCase().includes(normalizedQueryString) ||
                  value.toLocaleLowerCase().includes(normalizedQueryString)
              );
              shouldKeep = doesNameContainsQueryString || Boolean(doLabelsContainQueryString?.length);
            }
            if (filters.alertState) {
              const matchesAlertState = Boolean(
                rule.promRule && isAlertingRule(rule.promRule) && rule.promRule.state === filters.alertState
              );

              shouldKeep = shouldKeep && matchesAlertState;
            }
            return shouldKeep;
          });
          if (rules.length) {
            groupCopy.rules = rules;
            groupAcc.push(groupCopy);
          }
          return groupAcc;
        }, [] as CombinedRuleGroup[]);

        if (filteredGroups.length) {
          namespace.groups = filteredGroups;
          acc.push(namespace);
        }

        return acc;
      }, [] as CombinedRuleNamespace[]);
    return filteredNamespaces;
  }, [filters.alertState, filters.queryString, filters.dataSource, namespaces]);
};
