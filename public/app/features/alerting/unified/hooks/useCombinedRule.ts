import { useEffect, useMemo } from 'react';
import { useAsync } from 'react-use';

import { useDispatch } from 'app/types';
import { CombinedRule, RuleIdentifier, RuleNamespace, RulerDataSourceConfig } from 'app/types/unified-alerting';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

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

import {
  combinePromAndRulerRules,
  combineRulesNamespaces,
  useCombinedRuleNamespaces,
} from './useCombinedRuleNamespaces';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';

export function useCombinedRule(
  identifier: RuleIdentifier | undefined,
  ruleSourceName: string | undefined
): AsyncRequestState<CombinedRule> {
  const requestState = useCombinedRulesLoader(ruleSourceName, identifier);
  const combinedRules = useCombinedRuleNamespaces(ruleSourceName);

  const rule = useMemo(() => {
    if (!identifier || !ruleSourceName || combinedRules.length === 0) {
      return;
    }

    for (const namespace of combinedRules) {
      for (const group of namespace.groups) {
        for (const rule of group.rules) {
          const id = ruleId.fromCombinedRule(ruleSourceName, rule);

          if (ruleId.equal(id, identifier)) {
            return rule;
          }
        }
      }
    }

    return;
  }, [identifier, ruleSourceName, combinedRules]);

  return {
    ...requestState,
    result: rule,
  };
}

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

export function useCombinedRuleLight({ ruleIdentifier }: { ruleIdentifier: RuleIdentifier }): {
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
  } = alertRuleApi.endpoints.prometheusRuleNamespaces.useQuery({
    ruleIdentifier: ruleIdentifier,
  });

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

    if (isPrometheusRuleIdentifier(ruleIdentifier) || isCloudRuleIdentifier(ruleIdentifier)) {
      fetchRulerRuleGroup({
        rulerConfig: dsFeatures.rulerConfig,
        namespace: ruleIdentifier.namespace,
        group: ruleIdentifier.groupName,
      });
    } else if (isGrafanaRuleIdentifier(ruleIdentifier)) {
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
      promRuleNs.length === 1 &&
      (isPrometheusRuleIdentifier(ruleIdentifier) || isCloudRuleIdentifier(ruleIdentifier))
    ) {
      const namespace = combinePromAndRulerRules(dsSettings, promRuleNs[0], rulerRuleGroup);
      if (!namespace) {
        return;
      }

      for (const group of namespace.groups) {
        for (const rule of group.rules) {
          const id = ruleId.fromCombinedRule(ruleSourceName, rule);

          if (ruleId.equal(id, ruleIdentifier)) {
            return rule;
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
