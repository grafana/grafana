import { useMemo } from 'react';

import { PromRuleType } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { Annotation, GRAFANA_RULES_SOURCE_NAME } from '../utils/constants';

// The annotations that make an alert notification actionable. A rule is considered
// incomplete when any of these is missing or empty.
const REQUIRED_ANNOTATIONS = [Annotation.summary, Annotation.description, Annotation.runbookURL];

export interface IncompleteRule {
  uid?: string;
  name: string;
  folder: string;
  group: string;
  missing: Annotation[];
}

/**
 * Returns Grafana-managed alerting rules that are missing one or more actionable
 * annotations (summary, description, runbook URL), along with the total number of
 * alerting rules considered. Recording rules are excluded because they don't produce
 * notifications.
 */
export function useIncompleteRules(): {
  rules: IncompleteRule[];
  totalRules: number;
  isLoading: boolean;
  refetch: () => void;
} {
  const {
    data: namespaces = [],
    isLoading,
    refetch,
  } = alertRuleApi.endpoints.prometheusRuleNamespaces.useQuery({
    ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
    excludeAlerts: true,
  });

  const { rules, totalRules } = useMemo(() => {
    const result: IncompleteRule[] = [];
    let total = 0;
    for (const namespace of namespaces) {
      for (const group of namespace.groups) {
        for (const rule of group.rules) {
          if (rule.type !== PromRuleType.Alerting) {
            continue;
          }
          total++;
          const annotations = rule.annotations ?? {};
          const missing = REQUIRED_ANNOTATIONS.filter((key) => !annotations[key]?.trim());
          if (missing.length > 0) {
            result.push({
              uid: 'uid' in rule ? rule.uid : undefined,
              name: rule.name,
              folder: namespace.name,
              group: group.name,
              missing,
            });
          }
        }
      }
    }
    return { rules: result, totalRules: total };
  }, [namespaces]);

  return { rules, totalRules, isLoading, refetch };
}
