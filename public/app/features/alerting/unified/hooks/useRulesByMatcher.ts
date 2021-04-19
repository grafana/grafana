import { useMemo } from 'react';
import { SilenceMatcher } from 'app/plugins/datasource/alertmanager/types';
import { useCombinedRuleNamespaces } from './useCombinedRuleNamespaces';
import { CombinedRule } from 'app/types/unified-alerting';

export const useRulesByMatcher = (matchers: SilenceMatcher[]) => {
  const namespaces = useCombinedRuleNamespaces();
  return useMemo(() => {
    return namespaces.reduce((rulesAcc, namespace) => {
      namespace.groups.forEach((group) => {
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
          rulesAcc.push(...rules);
        }
      });
      return rulesAcc;
    }, [] as CombinedRule[]);
  }, [namespaces, matchers]);
};
