import { useEffect, useMemo, useRef } from 'react';
import { useAsync } from 'react-use';

import { useDispatch } from 'app/types';
import {
  CombinedRule,
  CombinedRuleNamespace,
  RuleIdentifier,
  RuleNamespace,
  RulerDataSourceConfig,
} from 'app/types/unified-alerting';
import { RulerRuleGroupDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { fetchPromAndRulerRulesAction } from '../state/actions';
import {
  getDataSourceByName,
  getRulesSourceByName,
  GRAFANA_RULES_SOURCE_NAME,
  isGrafanaRulesSource,
} from '../utils/datasource';
import { AsyncRequestMapSlice, AsyncRequestState, initialAsyncRequestState } from '../utils/redux';
import * as ruleId from '../utils/rule-id';
import {
  isCloudRuleIdentifier,
  isGrafanaRuleIdentifier,
  isGrafanaRulerRule,
  isPrometheusRuleIdentifier,
  isRulerNotSupportedResponse,
} from '../utils/rules';

import {
  addPromGroupsToCombinedNamespace,
  addRulerGroupsToCombinedNamespace,
  attachRulerRulesToCombinedRules,
  CacheValue,
  combineRulesNamespaces,
  useCombinedRuleNamespaces,
} from './useCombinedRuleNamespaces';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';

export function useCombinedRulesMatching(
  ruleName: string | undefined,
  ruleSourceName: string | undefined
): AsyncRequestState<CombinedRule[]> {
  const requestState = useCombinedRulesLoader(ruleSourceName);
  const combinedRules = useCombinedRuleNamespaces(ruleSourceName);

  const rules = useMemo(() => {
    if (!ruleName || !ruleSourceName || combinedRules.length === 0) {
      return [];
    }

    const rules: CombinedRule[] = [];

    for (const namespace of combinedRules) {
      for (const group of namespace.groups) {
        for (const rule of group.rules) {
          if (rule.name === ruleName) {
            rules.push(rule);
          }
        }
      }
    }

    return rules;
  }, [ruleName, ruleSourceName, combinedRules]);

  return {
    ...requestState,
    result: rules,
  };
}

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

  const [fetchRulerRuleGroup] = alertRuleApi.endpoints.rulerRuleGroup.useLazyQuery();

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

function useCombinedRulesLoader(
  rulesSourceName: string | undefined,
  identifier?: RuleIdentifier
): AsyncRequestState<void> {
  const dispatch = useDispatch();
  const promRuleRequests = useUnifiedAlertingSelector((state) => state.promRules);
  const promRuleRequest = getRequestState(rulesSourceName, promRuleRequests);
  const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
  const rulerRuleRequest = getRequestState(rulesSourceName, rulerRuleRequests);

  const { loading } = useAsync(async () => {
    if (!rulesSourceName) {
      return;
    }

    await dispatch(fetchPromAndRulerRulesAction({ rulesSourceName, identifier }));
  }, [dispatch, rulesSourceName]);

  return {
    loading,
    error: promRuleRequest.error ?? isRulerNotSupportedResponse(rulerRuleRequest) ? undefined : rulerRuleRequest.error,
    dispatched: promRuleRequest.dispatched && rulerRuleRequest.dispatched,
  };
}

function getRequestState(
  ruleSourceName: string | undefined,
  slice: AsyncRequestMapSlice<RulerRulesConfigDTO | RuleNamespace[] | null>
): AsyncRequestState<RulerRulesConfigDTO | RuleNamespace[] | null> {
  if (!ruleSourceName) {
    return initialAsyncRequestState;
  }

  const state = slice[ruleSourceName];

  if (!state) {
    return initialAsyncRequestState;
  }

  return state;
}

/*
  This hook returns combined Grafana rules by dashpboard UID
*/
export function useCombinedRulesByDashboard(
  dashboardUID: string,
  panelId?: number
): {
  loading: boolean;
  result?: CombinedRuleNamespace[];
  error?: unknown;
} {
  const {
    currentData: promRuleNs,
    isLoading: isLoadingPromRules,
    error: promRuleNsError,
  } = alertRuleApi.endpoints.prometheusRuleNamespaces.useQuery({
    ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
    dashboardUid: dashboardUID,
    panelId,
  });

  const {
    currentData: rulerRules,
    isLoading: isLoadingRulerRules,
    error: rulerRulesError,
  } = alertRuleApi.endpoints.rulerRules.useQuery({
    rulerConfig: grafanaRulerConfig,
    filter: { dashboardUID: dashboardUID, panelId },
  });

  //---------
  // cache results per rules source, so we only recalculate those for which results have actually changed
  const cache = useRef<Record<string, CacheValue>>({});

  const rulesSource = getRulesSourceByName(GRAFANA_RULES_SOURCE_NAME);

  const rules = useMemo(() => {
    if (!rulesSource) {
      return [];
    }

    const cached = cache.current[GRAFANA_RULES_SOURCE_NAME];
    if (cached && cached.promRules === promRuleNs && cached.rulerRules === rulerRules) {
      return cached.result;
    }
    const namespaces: Record<string, CombinedRuleNamespace> = {};

    // first get all the ruler rules from the data source
    Object.entries(rulerRules || {}).forEach(([namespaceName, groups]) => {
      const namespace: CombinedRuleNamespace = {
        rulesSource,
        name: namespaceName,
        groups: [],
      };

      // We need to set the namespace_uid for grafana rules as it's required to obtain the rule's groups
      // All rules from all groups have the same namespace_uid so we're taking the first one.
      if (isGrafanaRulerRule(groups[0].rules[0])) {
        namespace.uid = groups[0].rules[0].grafana_alert.namespace_uid;
      }

      namespaces[namespaceName] = namespace;
      addRulerGroupsToCombinedNamespace(namespace, groups);
    });

    // then correlate with prometheus rules
    promRuleNs?.forEach(({ name: namespaceName, groups }) => {
      const ns = (namespaces[namespaceName] = namespaces[namespaceName] || {
        rulesSource,
        name: namespaceName,
        groups: [],
      });

      addPromGroupsToCombinedNamespace(ns, groups);
    });

    const result = Object.values(namespaces);

    cache.current[GRAFANA_RULES_SOURCE_NAME] = { promRules: promRuleNs, rulerRules, result };
    return result;
  }, [promRuleNs, rulerRules, rulesSource]);

  return {
    loading: isLoadingPromRules || isLoadingRulerRules,
    error: promRuleNsError ?? rulerRulesError,
    result: rules,
  };
}

export function useCombinedRule({ ruleIdentifier }: { ruleIdentifier: RuleIdentifier }): {
  loading: boolean;
  result?: CombinedRule;
  error?: unknown;
} {
  const { ruleSourceName } = ruleIdentifier;
  const dsSettings = getDataSourceByName(ruleSourceName);

  const { dsFeatures, isLoadingDsFeatures } = useDataSourceFeatures(ruleSourceName);

  const {
    currentData: promRuleNs,
    isLoading: isLoadingPromRules,
    error: promRuleNsError,
  } = alertRuleApi.endpoints.prometheusRuleNamespaces.useQuery(
    {
      // TODO Refactor parameters
      ruleSourceName: ruleIdentifier.ruleSourceName,
      namespace:
        isPrometheusRuleIdentifier(ruleIdentifier) || isCloudRuleIdentifier(ruleIdentifier)
          ? ruleIdentifier.namespace
          : undefined,
      groupName:
        isPrometheusRuleIdentifier(ruleIdentifier) || isCloudRuleIdentifier(ruleIdentifier)
          ? ruleIdentifier.groupName
          : undefined,
      ruleName:
        isPrometheusRuleIdentifier(ruleIdentifier) || isCloudRuleIdentifier(ruleIdentifier)
          ? ruleIdentifier.ruleName
          : undefined,
    }
    // TODO – experiment with enabling these now that we request a single alert rule more efficiently.
    // Requires a recent version of Prometheus with support for query params on /api/v1/rules
    // {
    //   refetchOnFocus: true,
    //   refetchOnReconnect: true,
    // }
  );

  const [
    fetchRulerRuleGroup,
    { currentData: rulerRuleGroup, isLoading: isLoadingRulerGroup, error: rulerRuleGroupError },
  ] = alertRuleApi.endpoints.rulerRuleGroup.useLazyQuery();

  const [fetchRulerRules, { currentData: rulerRules, isLoading: isLoadingRulerRules, error: rulerRulesError }] =
    alertRuleApi.endpoints.rulerRules.useLazyQuery();

  useEffect(() => {
    if (!dsFeatures?.rulerConfig) {
      return;
    }

    if (dsFeatures.rulerConfig && isCloudRuleIdentifier(ruleIdentifier)) {
      fetchRulerRuleGroup({
        rulerConfig: dsFeatures.rulerConfig,
        namespace: ruleIdentifier.namespace,
        group: ruleIdentifier.groupName,
      });
    } else if (isGrafanaRuleIdentifier(ruleIdentifier)) {
      // TODO Fetch a single group for Grafana managed rules, we're currently still fetching all rules for Grafana managed
      fetchRulerRules({ rulerConfig: dsFeatures.rulerConfig });
    }
  }, [dsFeatures, fetchRulerRuleGroup, fetchRulerRules, ruleIdentifier]);

  const rule = useMemo(() => {
    if (!promRuleNs) {
      return;
    }

    if (isGrafanaRuleIdentifier(ruleIdentifier)) {
      const combinedNamespaces = combineRulesNamespaces('grafana', promRuleNs, rulerRules);

      for (const namespace of combinedNamespaces) {
        for (const group of namespace.groups) {
          for (const rule of group.rules) {
            const id = ruleId.fromCombinedRule(ruleSourceName, rule);

            if (ruleId.equal(id, ruleIdentifier)) {
              return rule;
            }
          }
        }
      }
    }

    if (!dsSettings) {
      return;
    }

    if (
      promRuleNs.length > 0 &&
      (isCloudRuleIdentifier(ruleIdentifier) || isPrometheusRuleIdentifier(ruleIdentifier))
    ) {
      const namespaces = promRuleNs.map((ns) =>
        attachRulerRulesToCombinedRules(dsSettings, ns, rulerRuleGroup ? [rulerRuleGroup] : [])
      );

      for (const namespace of namespaces) {
        for (const group of namespace.groups) {
          for (const rule of group.rules) {
            const id = ruleId.fromCombinedRule(ruleSourceName, rule);

            if (ruleId.equal(id, ruleIdentifier)) {
              return rule;
            }
          }
        }
      }
    }

    return;
  }, [ruleIdentifier, ruleSourceName, promRuleNs, rulerRuleGroup, rulerRules, dsSettings]);

  return {
    loading: isLoadingDsFeatures || isLoadingPromRules || isLoadingRulerGroup || isLoadingRulerRules,
    error: promRuleNsError ?? rulerRuleGroupError ?? rulerRulesError,
    result: rule,
  };
}

const grafanaRulerConfig: RulerDataSourceConfig = {
  dataSourceName: GRAFANA_RULES_SOURCE_NAME,
  apiVersion: 'legacy',
};

const grafanaDsFeatures = {
  rulerConfig: grafanaRulerConfig,
};

export function useDataSourceFeatures(dataSourceName: string) {
  const isGrafanaDs = isGrafanaRulesSource(dataSourceName);

  const { currentData: dsFeatures, isLoading: isLoadingDsFeatures } =
    featureDiscoveryApi.endpoints.discoverDsFeatures.useQuery(
      {
        rulesSourceName: dataSourceName,
      },
      { skip: isGrafanaDs }
    );

  if (isGrafanaDs) {
    return { isLoadingDsFeatures: false, dsFeatures: grafanaDsFeatures };
  }

  return { isLoadingDsFeatures, dsFeatures };
}
