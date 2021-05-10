import { SerializedError } from '@reduxjs/toolkit';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { CombinedRule } from 'app/types/unified-alerting';
import { useDispatch } from 'react-redux';
import { fetchPromRulesAction, fetchRulerRulesAction } from '../state/actions';
import { Annotation, RULE_LIST_POLL_INTERVAL_MS } from '../utils/constants';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { initialAsyncRequestState } from '../utils/redux';
import { useCombinedRuleNamespaces } from './useCombinedRuleNamespaces';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
import { useEffect, useMemo } from 'react';
import { urlUtil } from '@grafana/data';

interface Options {
  dashboard: DashboardModel;
  panel: PanelModel;

  poll?: boolean;
}

interface ReturnBag {
  errors: SerializedError[];
  rules: CombinedRule[];

  loading?: boolean;
}

const RE_DASHBOARD_URL = /\/d\/(\w+)\//;

export function usePanelCombinedRules({ dashboard, panel, poll = false }: Options): ReturnBag {
  const dispatch = useDispatch();

  const promRuleRequest =
    useUnifiedAlertingSelector((state) => state.promRules[GRAFANA_RULES_SOURCE_NAME]) ?? initialAsyncRequestState;
  const rulerRuleRequest =
    useUnifiedAlertingSelector((state) => state.rulerRules[GRAFANA_RULES_SOURCE_NAME]) ?? initialAsyncRequestState;

  // fetch rules, then poll every RULE_LIST_POLL_INTERVAL_MS
  useEffect(() => {
    const fetch = () => {
      dispatch(fetchPromRulesAction(GRAFANA_RULES_SOURCE_NAME));
      dispatch(fetchRulerRulesAction(GRAFANA_RULES_SOURCE_NAME));
    };
    fetch();
    if (poll) {
      const interval = setInterval(fetch, RULE_LIST_POLL_INTERVAL_MS);
      return () => {
        clearInterval(interval);
      };
    }
    return () => {};
  }, [dispatch, poll]);

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
        .filter((rule) => doesRuleBelongToPanel(rule, panel, dashboard)),
    [combinedNamespaces, dashboard, panel]
  );

  return {
    rules,
    errors,
    loading,
  };
}

function doesRuleBelongToPanel(rule: CombinedRule, panel: PanelModel, dashboard: DashboardModel): boolean {
  if (
    rule.annotations[Annotation.dashboardUID] === dashboard.uid &&
    rule.annotations[Annotation.panelID] === String(panel.editSourceId)
  ) {
    return true;
    // failing that, match based on panel URL annotation
  } else if (rule.annotations[Annotation.panelURL]) {
    console.log(rule.annotations[Annotation.panelURL]);
    const [path, search] = rule.annotations[Annotation.panelURL].split('?');
    if (!(path && search)) {
      return false;
    }
    const queryParams = urlUtil.parseKeyValue(search);
    const panelId = queryParams['viewPanel'] ?? queryParams['editPanel'];
    const match = RE_DASHBOARD_URL.exec(path);
    console.log(match, queryParams);
    if (match && match[1] === dashboard.uid && String(panelId) === String(panel.editSourceId)) {
      return true;
    }
  }

  return false;
}
