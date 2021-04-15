import { useMemo } from 'react';
import { SilenceMatcher } from 'app/plugins/datasource/alertmanager/types';
import { useCombinedRuleNamespaces } from './useCombinedRuleNamespaces';
import { CombinedRuleGroup, CombinedRuleNamespace } from 'app/types/unified-alerting';

export const useRulesByMatcher = (matchers: SilenceMatcher[]) => {
  const namespaces = useCombinedRuleNamespaces();
  return useMemo(() => {
    return namespaces.reduce((namespaceAcc, namespace) => {
      const groups = namespace.groups.reduce((groupAcc, group) => {
        const rules = group.rules.filter(({ labels }) => {
          return matchers.every(({ name, value, isRegex }) => {
            return Object.entries(labels).filter(([labelKey, labelValue]) => {
              const nameMatches = name === labelKey;
              const valueMatches = isRegex ? new RegExp(value).test(labelValue) : value === labelValue;
              return nameMatches && valueMatches;
            }).length;
          });
        });

        if (rules.length) {
          groupAcc.push({
            ...group,
            rules,
          });
        }
        return groupAcc;
      }, [] as CombinedRuleGroup[]);

      if (groups.length) {
        namespaceAcc.push({
          ...namespace,
          groups,
        });
      }
      return namespaceAcc;
    }, [] as CombinedRuleNamespace[]);
  }, [namespaces, matchers]);
};
