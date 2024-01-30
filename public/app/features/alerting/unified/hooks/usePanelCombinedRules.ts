import { SerializedError } from '@reduxjs/toolkit';
import { useEffect, useMemo } from 'react';

import { useDispatch } from 'app/types';
import { CombinedRule } from 'app/types/unified-alerting';

import { fetchPromRulesAction, fetchRulerRulesAction } from '../state/actions';
import { Annotation, RULE_LIST_POLL_INTERVAL_MS } from '../utils/constants';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { initialAsyncRequestState } from '../utils/redux';

import { useCombinedRuleNamespaces } from './useCombinedRuleNamespaces';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';

interface Options {
  dashboardUID: string;
  panelId: number;

  poll?: boolean;
}

interface ReturnBag {
  errors: SerializedError[];
  rules: CombinedRule[];

  loading?: boolean;
}

export function usePanelCombinedRules({ dashboardUID, panelId, poll = false }: Options): ReturnBag {
  const dispatch = useDispatch();

  const promRuleRequest =
    useUnifiedAlertingSelector((state) => state.promRules[GRAFANA_RULES_SOURCE_NAME]) ?? initialAsyncRequestState;
  const rulerRuleRequest =
    useUnifiedAlertingSelector((state) => state.rulerRules[GRAFANA_RULES_SOURCE_NAME]) ?? initialAsyncRequestState;

  // fetch rules, then poll every RULE_LIST_POLL_INTERVAL_MS
  useEffect(() => {
    const fetch = () => {
      dispatch(
        fetchPromRulesAction({
          rulesSourceName: GRAFANA_RULES_SOURCE_NAME,
          filter: { dashboardUID, panelId },
        })
      );
      dispatch(
        fetchRulerRulesAction({
          rulesSourceName: GRAFANA_RULES_SOURCE_NAME,
          filter: { dashboardUID, panelId },
        })
      );
    };
    fetch();
    if (poll) {
      const interval = setInterval(fetch, RULE_LIST_POLL_INTERVAL_MS);
      return () => {
        clearInterval(interval);
      };
    }
    return () => {};
  }, [dispatch, poll, panelId, dashboardUID]);

  const loading = promRuleRequest.loading || rulerRuleRequest.loading;
  const errors = [promRuleRequest.error, rulerRuleRequest.error].filter(
    (err: SerializedError | undefined): err is SerializedError => !!err
  );

  const combinedNamespaces = useCombinedRuleNamespaces(GRAFANA_RULES_SOURCE_NAME);

  // filter out rules that are relevant to this panel
  const rules = useMemo(
    (): CombinedRule[] =>
      combinedNamespaces
        .flatMap((ns) => ns.groups)
        .flatMap((group) => group.rules)
        .filter(
          (rule) =>
            rule.annotations[Annotation.dashboardUID] === dashboardUID &&
            rule.annotations[Annotation.panelID] === String(panelId)
        ),
    [combinedNamespaces, dashboardUID, panelId]
  );

  return {
    rules,
    errors,
    loading,
  };
}
