import { useState, useEffect } from 'react';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
import { DataSourceInstanceSettings } from '@grafana/data';
import { RuleGroup, RuleNamespace } from 'app/types/unified-alerting';

type UnifiedNamespace = {
  namespace: RuleNamespace;
  dataSource: DataSourceInstanceSettings;
};

export const useFilteredRules = (namespaces: UnifiedNamespace[]) => {
  const [filteredRules, setFilteredRules] = useState<UnifiedNamespace[]>([]);
  const { rulesFilters } = useUnifiedAlertingSelector((state) => state.filters);

  useEffect(() => {
    const filteredNamespaces = namespaces
      .filter(({ namespace }) =>
        rulesFilters.dataSource ? namespace.dataSourceName === rulesFilters.dataSource : true
      )
      .reduce((acc, unifiedNamespace) => {
        const { namespace } = unifiedNamespace;
        const groups = namespace.groups.reduce((groupAcc, group) => {
          const groupCopy = { ...group };
          const rules = groupCopy.rules.filter((rule) => {
            if (rulesFilters.queryString) {
              const normalizedQueryString = rulesFilters.queryString.toLocaleLowerCase();
              const doesNameContainsQueryString = rule.name.toLocaleLowerCase().includes(normalizedQueryString);

              const doLabelsContainQueryString = Object.entries(rule.labels || {}).find(
                ([key, value]) =>
                  key.toLocaleLowerCase().includes(normalizedQueryString) ||
                  value.toLocaleLowerCase().includes(normalizedQueryString)
              );
              return doesNameContainsQueryString || doLabelsContainQueryString;
            }
            return true;
          });
          if (rules.length) {
            groupCopy.rules = rules;
            groupAcc.push(groupCopy);
          }
          return groupAcc;
        }, [] as RuleGroup[]);

        if (groups.length) {
          unifiedNamespace.namespace.groups = groups;
          acc.push(unifiedNamespace);
        }

        return acc;
      }, [] as UnifiedNamespace[]);
    setFilteredRules(filteredNamespaces);
  }, [namespaces, rulesFilters.dataSource, rulesFilters.queryString]);

  return filteredRules;
};
