import { useEffect, useState } from 'react';
import { CombinedRule, RuleIdentifier } from 'app/types/unified-alerting';
import { AsyncRequestState } from '../utils/redux';
import { useCombinedRuleNamespaces } from './useCombinedRuleNamespaces';
import { equalIdentifiers, getRuleIdentifier } from '../utils/rules';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
import { fetchPromRulesAction, fetchRulerRulesAction } from '../state/actions';
import { useDispatch } from 'react-redux';

export function useCombinedRule(
  identifier: RuleIdentifier | undefined,
  ruleSourceName: string | undefined
): AsyncRequestState<CombinedRule> {
  const [rule, setRule] = useState<CombinedRule | undefined>();
  const requestState = useCombinedRulesLoader(ruleSourceName);
  const combinedRules = useCombinedRuleNamespaces(ruleSourceName);

  useEffect(() => {
    if (!identifier || !ruleSourceName || combinedRules.length === 0 || rule) {
      return;
    }

    let combinedRule: CombinedRule | undefined;

    namespaces: for (const namespace of combinedRules) {
      for (const group of namespace.groups) {
        for (const rule of group.rules) {
          if (!rule.rulerRule) {
            continue;
          }

          const id = getRuleIdentifier(ruleSourceName, namespace.name, group.name, rule.rulerRule);

          if (equalIdentifiers(id, identifier)) {
            combinedRule = rule;
            break namespaces;
          }
        }
      }
    }

    setRule(combinedRule);
  }, [combinedRules, identifier, rule, ruleSourceName]);

  return {
    ...requestState,
    result: rule,
  };
}

function useCombinedRulesLoader(ruleSourceName = ''): AsyncRequestState<void> {
  const dispatch = useDispatch();
  const promRuleRequests = useUnifiedAlertingSelector((state) => state.promRules);
  const promRuleRequest = promRuleRequests[ruleSourceName];
  const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
  const rulerRuleRequest = rulerRuleRequests[ruleSourceName];

  useEffect(() => {
    if (!ruleSourceName) {
      return;
    }

    if (!promRuleRequest?.dispatched) {
      dispatch(fetchPromRulesAction(ruleSourceName));
    }

    if (!rulerRuleRequest?.dispatched) {
      dispatch(fetchRulerRulesAction(ruleSourceName));
    }
  }, [promRuleRequest?.dispatched, rulerRuleRequest?.dispatched, dispatch, ruleSourceName]);

  return {
    loading: (promRuleRequest?.loading || rulerRuleRequest?.loading) ?? false,
    error: promRuleRequest?.error ?? rulerRuleRequest?.error,
    dispatched: (promRuleRequest?.dispatched && rulerRuleRequest?.dispatched) ?? false,
  };
}
