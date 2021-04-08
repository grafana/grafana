import { useState, useEffect } from 'react';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
import { CombinedRuleGroup, CombinedRuleNamespace } from 'app/types/unified-alerting';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { isCloudRulesSource } from '../utils/datasource';
import { omitBy, isUndefined } from 'lodash';

type UnifiedNamespace = {
  namespace: RuleNamespace;
  dataSource: DataSourceInstanceSettings;
};

export const useFilteredRules = (namespaces: CombinedRuleNamespace[]) => {
  const [filteredRules, setFilteredRules] = useState<CombinedRuleNamespace[]>([]);
  const { rulesFilters } = useUnifiedAlertingSelector((state) => state.filters);

  useEffect(() => {
    const filteredNamespaces = namespaces
      .filter(({ rulesSource }) =>
        rulesFilters.dataSource && isCloudRulesSource(rulesSource) ? rulesSource.name === rulesFilters.dataSource : true
      )
      .reduce((acc, namespace) => {
        const { groups } = namespace;
        const filteredGroups = groups.reduce((groupAcc, group) => {
          const groupCopy = { ...group };
          const rules = groupCopy.rules.filter((rule) => {
            let shouldKeep = true;
            if (rulesFilters.queryString) {
              const normalizedQueryString = rulesFilters.queryString.toLocaleLowerCase();
              const doesNameContainsQueryString = rule.name.toLocaleLowerCase().includes(normalizedQueryString);

              const doLabelsContainQueryString = Object.entries(rule.labels || {}).find(
                ([key, value]) =>
                  key.toLocaleLowerCase().includes(normalizedQueryString) ||
                  value.toLocaleLowerCase().includes(normalizedQueryString)
              );
              shouldKeep = doesNameContainsQueryString || Boolean(doLabelsContainQueryString?.length);
            }
            if (rulesFilters.alertState) {
              const matchesAlertState =
                rule?.promRule?.type === 'alerting' && rule.promRule.state === rulesFilters.alertState;

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
    setFilteredRules(filteredNamespaces);
  }, [namespaces, rulesFilters.dataSource, rulesFilters.queryString, rulesFilters.alertState]);

  return filteredRules;
};
