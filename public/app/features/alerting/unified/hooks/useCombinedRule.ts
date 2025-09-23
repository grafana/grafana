import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo } from 'react';
import { useAsync } from 'react-use';

import { isGrafanaRulesSource } from 'app/features/alerting/unified/utils/datasource';
import { CombinedRule, RuleIdentifier, RuleWithLocation, RulesSource } from 'app/types/unified-alerting';
import { RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { getDataSourceByName } from '../utils/datasource';
import * as ruleId from '../utils/rule-id';
import { isCloudRuleIdentifier, isGrafanaRuleIdentifier, isPrometheusRuleIdentifier } from '../utils/rules';

import { attachRulerRulesToCombinedRules, combineRulesNamespace } from './useCombinedRuleNamespaces';
import { stringifyFolder, useFolder } from './useFolder';

export function useCloudCombinedRulesMatching(
  ruleName: string,
  ruleSourceName: string,
  filter?: { namespace?: string; groupName?: string }
): { loading: boolean; error?: unknown; rules?: CombinedRule[] } {
  const dsSettings = getDataSourceByName(ruleSourceName);
  const { dsFeatures, isLoadingDsFeatures } = useDataSourceFeatures(ruleSourceName);

  const {
    currentData,
    isLoading: isLoadingPromRules,
    error: promRuleNsError,
  } = alertRuleApi.endpoints.prometheusRuleNamespaces.useQuery({
    ruleSourceName: ruleSourceName,
    ruleName: ruleName,
    namespace: filter?.namespace,
    groupName: filter?.groupName,
  });

  const [fetchRulerRuleGroup] = alertRuleApi.endpoints.getRuleGroupForNamespace.useLazyQuery();

  const { loading, error, value } = useAsync(async () => {
    if (!dsSettings) {
      throw new Error('Unable to obtain data source settings');
    }

    if (promRuleNsError) {
      throw new Error('Unable to obtain Prometheus rules');
    }
    const promRuleNs = currentData || [];

    const rulerGroups: RulerRuleGroupDTO[] = [];
    if (dsFeatures?.rulerConfig) {
      const rulerConfig = dsFeatures.rulerConfig;

      const nsGroups = promRuleNs
        .map((namespace) => namespace.groups.map((group) => ({ namespace: namespace, group: group })))
        .flat();

      // RTK query takes care of deduplication
      await Promise.allSettled(
        nsGroups.map(async (nsGroup) => {
          const rulerGroup = await fetchRulerRuleGroup({
            rulerConfig: rulerConfig,
            namespace: nsGroup.namespace.name,
            group: nsGroup.group.name,
          }).unwrap();
          rulerGroups.push(rulerGroup);
        })
      );
    }

    // TODO Join with ruler rules
    const namespaces = promRuleNs.map((ns) => attachRulerRulesToCombinedRules(dsSettings, ns, rulerGroups));
    const rules = namespaces.flatMap((ns) => ns.groups.flatMap((group) => group.rules));

    return rules;
  }, [dsSettings, dsFeatures, isLoadingPromRules, promRuleNsError, currentData, fetchRulerRuleGroup]);

  return { loading: isLoadingDsFeatures || loading, error: error, rules: value };
}

interface RequestState<T> {
  result?: T;
  loading: boolean;
  error?: unknown;
}

interface Props {
  ruleIdentifier: RuleIdentifier;
  limitAlerts?: number;
}

// Many places still use the old way of fetching code so synchronizing cache expiration is difficult
// Hence, this hook fetches a fresh version of a rule most of the time
// Due to enabled filtering for Prometheus and Ruler rules it shouldn't be a problem
export function useCombinedRule({ ruleIdentifier, limitAlerts }: Props): RequestState<CombinedRule> {
  const { ruleSourceName } = ruleIdentifier;
  const ruleSource = getRulesSourceFromIdentifier(ruleIdentifier);

  const { dsFeatures, isLoadingDsFeatures } = useDataSourceFeatures(ruleSourceName);
  const {
    loading: isLoadingRuleLocation,
    error: ruleLocationError,
    result: ruleLocation,
  } = useRuleLocation(ruleIdentifier);

  const {
    currentData: promRuleNs = [],
    isLoading: isLoadingPromRules,
    error: promRuleNsError,
  } = alertRuleApi.endpoints.prometheusRuleNamespaces.useQuery(
    {
      ruleSourceName: ruleIdentifier.ruleSourceName,
      namespace: ruleLocation?.namespace,
      groupName: ruleLocation?.group,
      ruleName: ruleLocation?.ruleName,
      limitAlerts,
    },
    {
      skip: !ruleLocation || isLoadingRuleLocation,
      refetchOnMountOrArgChange: true,
    }
  );
  // in case of Grafana folder, we need to use the folder name instead of uid, as in promrules we don't use uid
  const isGrafanaRule = isGrafanaRulesSource(ruleSourceName);
  const folder = useFolder(isGrafanaRule ? ruleLocation?.namespace : undefined);
  const namespaceName = isGrafanaRule && folder.folder ? stringifyFolder(folder.folder) : ruleLocation?.namespace;

  const [
    fetchRulerRuleGroup,
    { currentData: rulerRuleGroup, isLoading: isLoadingRulerGroup, error: rulerRuleGroupError },
  ] = alertRuleApi.endpoints.getRuleGroupForNamespace.useLazyQuery();

  useEffect(() => {
    if (!dsFeatures?.rulerConfig || !ruleLocation) {
      return;
    }

    fetchRulerRuleGroup({
      rulerConfig: dsFeatures.rulerConfig,
      namespace: ruleLocation.namespace,
      group: ruleLocation.group,
    });
  }, [dsFeatures, fetchRulerRuleGroup, ruleLocation]);

  const rule = useMemo(() => {
    if (!ruleSource || !ruleLocation) {
      return;
    }

    const rulerConfig = rulerRuleGroup && namespaceName ? { [namespaceName]: [rulerRuleGroup] } : {};

    const combinedNamespaces = combineRulesNamespace(ruleSource, promRuleNs, rulerConfig);
    const combinedRules = combinedNamespaces.flatMap((ns) => ns.groups).flatMap((group) => group.rules);

    const matchingRule = combinedRules.find((rule) =>
      ruleId.equal(ruleId.fromCombinedRule(ruleSourceName, rule), ruleIdentifier)
    );

    return matchingRule;
  }, [ruleIdentifier, ruleSourceName, promRuleNs, rulerRuleGroup, ruleSource, ruleLocation, namespaceName]);

  return {
    loading: isLoadingRuleLocation || isLoadingDsFeatures || isLoadingPromRules || isLoadingRulerGroup,
    error: ruleLocationError ?? promRuleNsError ?? rulerRuleGroupError,
    result: rule,
  };
}

export interface RuleLocation {
  datasource: string;
  namespace: string;
  group: string;
  ruleName: string;
}

export function useRuleLocation(ruleIdentifier: RuleIdentifier): RequestState<RuleLocation> {
  const validIdentifier = (() => {
    if (isGrafanaRuleIdentifier(ruleIdentifier) && ruleIdentifier.uid !== '') {
      return { uid: ruleIdentifier.uid };
    }
    return skipToken;
  })();

  const { isLoading, currentData, error, isUninitialized } = alertRuleApi.endpoints.getAlertRule.useQuery(
    validIdentifier,
    {
      refetchOnMountOrArgChange: true,
    }
  );

  return useMemo(() => {
    if (isPrometheusRuleIdentifier(ruleIdentifier) || isCloudRuleIdentifier(ruleIdentifier)) {
      return {
        result: {
          datasource: ruleIdentifier.ruleSourceName,
          namespace: ruleIdentifier.namespace,
          group: ruleIdentifier.groupName,
          ruleName: ruleIdentifier.ruleName,
        },
        loading: false,
      };
    }

    if (isGrafanaRuleIdentifier(ruleIdentifier)) {
      if (isLoading || isUninitialized) {
        return { loading: true };
      }

      if (error) {
        return { loading: false, error };
      }
      if (currentData) {
        return {
          result: {
            datasource: ruleIdentifier.ruleSourceName,
            namespace: currentData.grafana_alert.namespace_uid,
            group: currentData.grafana_alert.rule_group,
            ruleName: currentData.grafana_alert.title,
          },
          loading: false,
        };
      }

      // In theory, this should never happen
      return {
        loading: false,
        error: new Error(`Unable to obtain rule location for rule ${ruleIdentifier.uid}`),
      };
    }

    return {
      loading: false,
      error: new Error('Unsupported rule identifier'),
    };
  }, [ruleIdentifier, isLoading, isUninitialized, error, currentData]);
}

function getRulesSourceFromIdentifier(ruleIdentifier: RuleIdentifier): RulesSource | undefined {
  if (isGrafanaRuleIdentifier(ruleIdentifier)) {
    return 'grafana';
  }

  return getDataSourceByName(ruleIdentifier.ruleSourceName);
}

// This Hook fetches rule definition from the Ruler API only
export function useRuleWithLocation({
  ruleIdentifier,
}: {
  ruleIdentifier: RuleIdentifier;
}): RequestState<RuleWithLocation> {
  const ruleSource = getRulesSourceFromIdentifier(ruleIdentifier);

  const { data: dsFeatures, isLoading: isLoadingDsFeatures } =
    featureDiscoveryApi.endpoints.discoverDsFeatures.useQuery({
      rulesSourceName: ruleIdentifier.ruleSourceName,
    });

  const {
    loading: isLoadingRuleLocation,
    error: ruleLocationError,
    result: ruleLocation,
  } = useRuleLocation(ruleIdentifier);

  const [
    fetchRulerRuleGroup,
    {
      currentData: rulerRuleGroup,
      isLoading: isLoadingRulerGroup,
      isUninitialized: isUninitializedRulerGroup,
      error: rulerRuleGroupError,
    },
  ] = alertRuleApi.endpoints.getRuleGroupForNamespace.useLazyQuery();

  useEffect(() => {
    if (!dsFeatures?.rulerConfig || !ruleLocation) {
      return;
    }

    fetchRulerRuleGroup({
      rulerConfig: dsFeatures.rulerConfig,
      namespace: ruleLocation.namespace,
      group: ruleLocation.group,
    });
  }, [dsFeatures, fetchRulerRuleGroup, ruleLocation]);

  const ruleWithLocation = useMemo(() => {
    const { ruleSourceName } = ruleIdentifier;
    if (!rulerRuleGroup || !ruleSource || !ruleLocation) {
      return;
    }

    const rule = rulerRuleGroup.rules.find((rule) => {
      const id = ruleId.fromRulerRule(ruleSourceName, ruleLocation.namespace, ruleLocation.group, rule);
      return ruleId.equal(id, ruleIdentifier);
    });

    if (!rule) {
      return;
    }

    return {
      ruleSourceName: ruleSourceName,
      group: rulerRuleGroup,
      namespace: ruleLocation.namespace,
      rule: rule,
    };
  }, [ruleIdentifier, rulerRuleGroup, ruleSource, ruleLocation]);

  return {
    loading: isLoadingRuleLocation || isLoadingDsFeatures || isLoadingRulerGroup || isUninitializedRulerGroup,
    error: ruleLocationError ?? rulerRuleGroupError,
    result: ruleWithLocation,
  };
}

export function useDataSourceFeatures(dataSourceName: string) {
  const { currentData: dsFeatures, isLoading: isLoadingDsFeatures } =
    featureDiscoveryApi.endpoints.discoverDsFeatures.useQuery({ rulesSourceName: dataSourceName });

  return { isLoadingDsFeatures, dsFeatures };
}
