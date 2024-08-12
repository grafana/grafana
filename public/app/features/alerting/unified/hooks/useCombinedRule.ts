import { useEffect, useMemo } from 'react';
import { useAsync } from 'react-use';

import { useDispatch } from 'app/types';
import {
  CombinedRule,
  RuleIdentifier,
  RuleNamespace,
  RulerDataSourceConfig,
  RulesSource,
  RuleWithLocation,
} from 'app/types/unified-alerting';
import { RulerRuleGroupDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { fetchPromAndRulerRulesAction } from '../state/actions';
import { getDataSourceByName, GRAFANA_RULES_SOURCE_NAME, isGrafanaRulesSource } from '../utils/datasource';
import { AsyncRequestMapSlice, AsyncRequestState, initialAsyncRequestState } from '../utils/redux';
import * as ruleId from '../utils/rule-id';
import {
  isCloudRuleIdentifier,
  isGrafanaRuleIdentifier,
  isPrometheusRuleIdentifier,
  isRulerNotSupportedResponse,
} from '../utils/rules';

import { attachRulerRulesToCombinedRules, useCombinedRuleNamespaces } from './useCombinedRuleNamespaces';
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
    error:
      (promRuleRequest.error ?? isRulerNotSupportedResponse(rulerRuleRequest)) ? undefined : rulerRuleRequest.error,
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
    currentData: promRuleNs,
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

  const [
    fetchRulerRuleGroup,
    {
      currentData: rulerRuleGroup,
      isLoading: isLoadingRulerGroup,
      error: rulerRuleGroupError,
      isUninitialized: rulerRuleGroupUninitialized,
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

  const rule = useMemo(() => {
    if (!promRuleNs || !ruleSource) {
      return;
    }

    if (promRuleNs.length > 0) {
      const namespaces = promRuleNs.map((ns) =>
        attachRulerRulesToCombinedRules(ruleSource, ns, rulerRuleGroup ? [rulerRuleGroup] : [])
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
  }, [ruleIdentifier, ruleSourceName, promRuleNs, rulerRuleGroup, ruleSource]);

  return {
    loading: isLoadingDsFeatures || isLoadingPromRules || isLoadingRulerGroup || rulerRuleGroupUninitialized,
    error: ruleLocationError ?? promRuleNsError ?? rulerRuleGroupError,
    result: rule,
  };
}

interface RuleLocation {
  namespace: string;
  group: string;
  ruleName: string;
}

function useRuleLocation(ruleIdentifier: RuleIdentifier): RequestState<RuleLocation> {
  const { isLoading, currentData, error, isUninitialized } = alertRuleApi.endpoints.getAlertRule.useQuery(
    { uid: isGrafanaRuleIdentifier(ruleIdentifier) ? ruleIdentifier.uid : '' },
    { skip: !isGrafanaRuleIdentifier(ruleIdentifier), refetchOnMountOrArgChange: true }
  );

  return useMemo(() => {
    if (isPrometheusRuleIdentifier(ruleIdentifier) || isCloudRuleIdentifier(ruleIdentifier)) {
      return {
        result: {
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

  const { dsFeatures, isLoadingDsFeatures } = useDataSourceFeatures(ruleIdentifier.ruleSourceName);
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

export const grafanaRulerConfig: RulerDataSourceConfig = {
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
