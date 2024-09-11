import { useEffect, useMemo } from 'react';

import { config } from '@grafana/runtime';
import { RuleNamespace } from 'app/types/unified-alerting';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { featureDiscoveryApi } from '../../api/featureDiscoveryApi';
import { isAlertingRule, isAlertingRulerRule } from '../../utils/rules';

const { usePrometheusRuleNamespacesQuery, useLazyRulerRulesQuery } = alertRuleApi;
const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;

const prometheusRulesPrimary = config.featureToggles.alertingPrometheusRulesPrimary ?? false;

export function useAlertRuleSuggestions(rulesSourceName: string) {
  const { data: features, isLoading: isFeaturesLoading } = useDiscoverDsFeaturesQuery({ rulesSourceName });

  const [fetchRulerRules, { data: rulerRules = {}, isLoading: isRulerRulesLoading }] = useLazyRulerRulesQuery();
  const { data: promNamespaces = [], isLoading: isPrometheusRulesLoading } = usePrometheusRuleNamespacesQuery(
    { ruleSourceName: rulesSourceName },
    { skip: !prometheusRulesPrimary }
  );

  useEffect(() => {
    if (features?.rulerConfig && !prometheusRulesPrimary) {
      fetchRulerRules({ rulerConfig: features.rulerConfig });
    }
  }, [features?.rulerConfig, fetchRulerRules]);

  const namespaceGroups = useMemo(() => {
    if (isPrometheusRulesLoading || isRulerRulesLoading) {
      return new Map<string, string[]>();
    }

    if (prometheusRulesPrimary) {
      return promNamespacesToNamespaceGroups(promNamespaces);
    }

    return rulerRulesToNamespaceGroups(rulerRules);
  }, [promNamespaces, rulerRules, isPrometheusRulesLoading, isRulerRulesLoading]);

  const labels = useMemo(() => {
    if (isPrometheusRulesLoading || isRulerRulesLoading) {
      return new Map<string, Set<string>>();
    }

    if (prometheusRulesPrimary) {
      performance.mark('promNamespacesToLabels:start');
      const result = promNamespacesToLabels(promNamespaces);
      performance.mark('promNamespacesToLabels:end');
      console.log(
        performance.measure('promNamespacesToLabels', 'promNamespacesToLabels:start', 'promNamespacesToLabels:end')
      );
      return result;
    }

    return rulerRulesToLabels(rulerRules);
  }, [promNamespaces, rulerRules, isPrometheusRulesLoading, isRulerRulesLoading]);

  return { namespaceGroups, labels, isLoading: isPrometheusRulesLoading || isRulerRulesLoading || isFeaturesLoading };
}

function promNamespacesToNamespaceGroups(promNamespaces: RuleNamespace[]) {
  const groups = new Map<string, string[]>();
  promNamespaces.forEach((namespace) => {
    groups.set(
      namespace.name,
      namespace.groups.map((group) => group.name)
    );
  });
  return groups;
}

function rulerRulesToNamespaceGroups(rulerConfig: RulerRulesConfigDTO) {
  const result = new Map<string, string[]>();
  Object.entries(rulerConfig).forEach(([namespace, groups]) => {
    result.set(
      namespace,
      groups.map((group) => group.name)
    );
  });
  return result;
}

function promNamespacesToLabels(promNamespace: RuleNamespace[]) {
  const rules = promNamespace
    .flatMap((namespace) => namespace.groups)
    .flatMap((group) => group.rules)
    .filter(isAlertingRule);

  return rules.reduce((result, rule) => {
    if (rule.labels) {
      Object.entries(rule.labels).forEach(([labelKey, labelValue]) => {
        if (!labelKey || !labelValue) {
          return;
        }

        const labelEntry = result.get(labelKey);
        if (labelEntry) {
          labelEntry.add(labelValue);
        } else {
          result.set(labelKey, new Set([labelValue]));
        }
      });
    }
    return result;
  }, new Map<string, Set<string>>());
}

function rulerRulesToLabels(rulerConfig: RulerRulesConfigDTO) {
  const result = new Map<string, Set<string>>();

  const rules = Object.entries(rulerConfig)
    .flatMap(([_, groups]) => groups)
    .flatMap((group) => group.rules)
    .filter(isAlertingRulerRule);

  return rules.reduce((result, rule) => {
    if (rule.labels) {
      Object.entries(rule.labels).forEach(([labelKey, labelValue]) => {
        if (!labelKey || !labelValue) {
          return;
        }

        const labelEntry = result.get(labelKey);
        if (labelEntry) {
          labelEntry.add(labelValue);
        } else {
          result.set(labelKey, new Set([labelValue]));
        }
      });
    }
    return result;
  }, result);
}
