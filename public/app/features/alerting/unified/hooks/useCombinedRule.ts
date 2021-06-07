import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { CombinedRule, RuleIdentifier, RuleNamespace } from 'app/types/unified-alerting';
import { AsyncRequestMapSlice, AsyncRequestState, initialAsyncRequestState } from '../utils/redux';
import { useCombinedRuleNamespaces } from './useCombinedRuleNamespaces';
import { equalIdentifiers, getRuleIdentifier } from '../utils/rules';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
import { fetchPromRulesAction, fetchRulerRulesAction } from '../state/actions';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

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
          if (!rule.rulerRule) {
            continue;
          }

          const id = getRuleIdentifier(ruleSourceName, namespace.name, group.name, rule.rulerRule);

          if (equalIdentifiers(id, identifier)) {
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

    if (!promRuleRequest.dispatched) {
      dispatch(fetchPromRulesAction(ruleSourceName));
    }

    if (!rulerRuleRequest.dispatched) {
      dispatch(fetchRulerRulesAction(ruleSourceName));
    }
  }, [promRuleRequest.dispatched, rulerRuleRequest.dispatched, dispatch, ruleSourceName]);

  return {
    loading: promRuleRequest.loading || rulerRuleRequest.loading,
    error: promRuleRequest.error ?? rulerRuleRequest.error,
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
