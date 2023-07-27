import { useEffect, useMemo } from 'react';
import { useAsync } from 'react-use';

import { useDispatch } from 'app/types';
import { CombinedRule, RuleIdentifier, RuleNamespace } from 'app/types/unified-alerting';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { fetchPromAndRulerRulesAction } from '../state/actions';
import { getDataSourceByName } from '../utils/datasource';
import { AsyncRequestMapSlice, AsyncRequestState, initialAsyncRequestState } from '../utils/redux';
import * as ruleId from '../utils/rule-id';
import {
  isCloudRuleIdentifier,
  isGrafanaRuleIdentifier,
  isPrometheusRuleIdentifier,
  isRulerNotSupportedResponse,
} from '../utils/rules';

import { combinePromAndRulerRules, useCombinedRuleNamespaces } from './useCombinedRuleNamespaces';
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
  error?: Error;
  result?: CombinedRule;
} {
  const { ruleSourceName } = ruleIdentifier;
  const dsSettings = getDataSourceByName(ruleSourceName);

  const { currentData: dsFeatures, isLoading: isLoadingDsFeatures } =
    featureDiscoveryApi.endpoints.discoverDsFeatures.useQuery({
      rulesSourceName: ruleSourceName,
    });

  const { currentData: promRuleNs, isLoading: isLoadingPromRules } =
    alertRuleApi.endpoints.prometheusRuleNamespace.useQuery({
      ruleIdentifier: ruleIdentifier,
    });

  const [fetchRulerRuleGroup, { currentData: rulerRuleGroup, isLoading: isLoadingRulerGroup }] =
    alertRuleApi.endpoints.rulerRuleGroup.useLazyQuery();

  const [fetchRulerRules, { currentData: rulerRules, isLoading: isLoadingRulerRules }] =
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
    if (!dsSettings || !promRuleNs) {
      return;
    }

    // TODO Add support for Grafana rules
    const namespace = combinePromAndRulerRules(dsSettings, promRuleNs, rulerRuleGroup);
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

    return;
  }, [ruleIdentifier, ruleSourceName, promRuleNs, rulerRuleGroup, dsSettings]);

  return {
    loading: isLoadingDsFeatures || isLoadingPromRules || isLoadingRulerGroup || isLoadingRulerRules,
    error: undefined, // TODO
    result: rule,
  };
}
