import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { CombinedRule, RuleIdentifier, RuleNamespace } from 'app/types/unified-alerting';
import { AsyncRequestMapSlice, AsyncRequestState, initialAsyncRequestState } from '../utils/redux';
import { useCombinedRuleNamespaces } from './useCombinedRuleNamespaces';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
import { fetchPromRulesAction, fetchRulerRulesAction } from '../state/actions';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';
import * as ruleId from '../utils/rule-id';
import { isRulerNotSupportedResponse } from '../utils/rules';

export function useCombinedRule(
  identifier: RuleIdentifier | undefined,
  ruleSourceName: string | undefined
): AsyncRequestState<CombinedRule> {
  const requestState = useCombinedRulesLoader(ruleSourceName);
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

function useCombinedRulesLoader(ruleSourceName: string | undefined): AsyncRequestState<void> {
  const dispatch = useDispatch();
  const promRuleRequests = useUnifiedAlertingSelector((state) => state.promRules);
  const promRuleRequest = getRequestState(ruleSourceName, promRuleRequests);
  const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
  const rulerRuleRequest = getRequestState(ruleSourceName, rulerRuleRequests);

  useEffect(() => {
    if (!ruleSourceName) {
      return;
    }

    dispatch(fetchPromRulesAction(ruleSourceName));
    dispatch(fetchRulerRulesAction(ruleSourceName));
  }, [dispatch, ruleSourceName]);

  return {
    loading: promRuleRequest.loading || rulerRuleRequest.loading,
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
