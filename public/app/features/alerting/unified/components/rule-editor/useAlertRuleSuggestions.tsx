import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo } from 'react';

import { RuleNamespace } from 'app/types/unified-alerting';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { featureDiscoveryApi } from '../../api/featureDiscoveryApi';
import { shouldUsePrometheusRulesPrimary } from '../../featureToggles';

const { usePrometheusRuleNamespacesQuery, useLazyRulerRulesQuery, useRulerRulesQuery } = alertRuleApi;
const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;

const prometheusRulesPrimary = shouldUsePrometheusRulesPrimary();
const emptyRulerConfig: RulerRulesConfigDTO = {};

export function useGetLabelsFromDataSourceName(rulesSourceName: string) {
  const { data: features, isLoading: isFeaturesLoading } = useDiscoverDsFeaturesQuery({ rulesSourceName });

  // emptyRulerConfig is used to prevent from triggering  labels' useMemo all the time
  // rulerRules = {} creates a new object and triggers useMemo to recalculate labels
  const [fetchRulerRules, { data: rulerRules = emptyRulerConfig, isLoading: isRulerRulesLoading }] =
    useLazyRulerRulesQuery();

  const { data: promNamespaces = [], isLoading: isPrometheusRulesLoading } = usePrometheusRuleNamespacesQuery(
    { ruleSourceName: rulesSourceName },
    { skip: !prometheusRulesPrimary }
  );

  useEffect(() => {
    if (features?.rulerConfig && !prometheusRulesPrimary) {
      fetchRulerRules({ rulerConfig: features.rulerConfig });
    }
  }, [features?.rulerConfig, fetchRulerRules]);

  const labels = useMemo(() => {
    if (isPrometheusRulesLoading || isRulerRulesLoading) {
      return new Map<string, Set<string>>();
    }

    if (prometheusRulesPrimary) {
      return promNamespacesToLabels(promNamespaces);
    }

    return rulerRulesToLabels(rulerRules);
  }, [promNamespaces, rulerRules, isPrometheusRulesLoading, isRulerRulesLoading]);

  return { labels, isLoading: isPrometheusRulesLoading || isRulerRulesLoading || isFeaturesLoading };
}

export function useGetNameSpacesByDatasourceName(rulesSourceName?: string) {
  const { data: features, isLoading: isFeaturesLoading } = useDiscoverDsFeaturesQuery(
    rulesSourceName ? { rulesSourceName } : skipToken,
    { skip: !rulesSourceName }
  );

  // emptyRulerConfig is used to prevent from triggering  labels' useMemo all the time
  // rulerRules = {} creates a new object and triggers useMemo to recalculate labels
  const [fetchRulerRules, { data: rulerRules = emptyRulerConfig, isLoading: isRulerRulesLoading }] =
    useLazyRulerRulesQuery();

  const { data: promNamespaces = [], isLoading: isPrometheusRulesLoading } = usePrometheusRuleNamespacesQuery(
    rulesSourceName && prometheusRulesPrimary ? { ruleSourceName: rulesSourceName } : skipToken
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

  return {
    namespaceGroups,
    isLoading: isPrometheusRulesLoading || isRulerRulesLoading || isFeaturesLoading,
    promNamespaces,
  };
}

export function useGetRulerRules(
  /** Rules source name to fetch namespaces from */
  rulesSourceName?: string
) {
  const { data: features, isLoading: isFeaturesLoading } = useDiscoverDsFeaturesQuery(
    rulesSourceName ? { rulesSourceName } : skipToken
  );

  const { data: rulerRules = emptyRulerConfig, isLoading: isRulerRulesLoading } = useRulerRulesQuery(
    features?.rulerConfig ? { rulerConfig: features.rulerConfig } : skipToken
  );

  return {
    isLoading: isRulerRulesLoading || isFeaturesLoading,
    rulerRules,
  };
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

export function rulerRulesToNamespaceGroups(rulerConfig: RulerRulesConfigDTO) {
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
  const rules = promNamespace.flatMap((namespace) => namespace.groups).flatMap((group) => group.rules);

  return rules.reduce((result, rule) => {
    if (!rule.labels) {
      return result;
    }

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
    return result;
  }, new Map<string, Set<string>>());
}

function rulerRulesToLabels(rulerConfig: RulerRulesConfigDTO) {
  const result = new Map<string, Set<string>>();

  const rules = Object.entries(rulerConfig)
    .flatMap(([_, groups]) => groups)
    .flatMap((group) => group.rules);

  return rules.reduce((result, rule) => {
    if (!rule.labels) {
      return result;
    }

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
    return result;
  }, result);
}
