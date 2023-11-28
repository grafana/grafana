import { useEffect, useMemo } from 'react';
import { useDispatch } from 'app/types';
import { fetchPromRulesAction, fetchRulerRulesAction } from '../state/actions';
import { Annotation, RULE_LIST_POLL_INTERVAL_MS } from '../utils/constants';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { initialAsyncRequestState } from '../utils/redux';
import { useCombinedRuleNamespaces } from './useCombinedRuleNamespaces';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
export function usePanelCombinedRules({ dashboard, panel, poll = false }) {
    var _a, _b;
    const dispatch = useDispatch();
    const promRuleRequest = (_a = useUnifiedAlertingSelector((state) => state.promRules[GRAFANA_RULES_SOURCE_NAME])) !== null && _a !== void 0 ? _a : initialAsyncRequestState;
    const rulerRuleRequest = (_b = useUnifiedAlertingSelector((state) => state.rulerRules[GRAFANA_RULES_SOURCE_NAME])) !== null && _b !== void 0 ? _b : initialAsyncRequestState;
    // fetch rules, then poll every RULE_LIST_POLL_INTERVAL_MS
    useEffect(() => {
        const fetch = () => {
            dispatch(fetchPromRulesAction({
                rulesSourceName: GRAFANA_RULES_SOURCE_NAME,
                filter: { dashboardUID: dashboard.uid, panelId: panel.id },
            }));
            dispatch(fetchRulerRulesAction({
                rulesSourceName: GRAFANA_RULES_SOURCE_NAME,
                filter: { dashboardUID: dashboard.uid, panelId: panel.id },
            }));
        };
        fetch();
        if (poll) {
            const interval = setInterval(fetch, RULE_LIST_POLL_INTERVAL_MS);
            return () => {
                clearInterval(interval);
            };
        }
        return () => { };
    }, [dispatch, poll, panel.id, dashboard.uid]);
    const loading = promRuleRequest.loading || rulerRuleRequest.loading;
    const errors = [promRuleRequest.error, rulerRuleRequest.error].filter((err) => !!err);
    const combinedNamespaces = useCombinedRuleNamespaces(GRAFANA_RULES_SOURCE_NAME);
    // filter out rules that are relevant to this panel
    const rules = useMemo(() => combinedNamespaces
        .flatMap((ns) => ns.groups)
        .flatMap((group) => group.rules)
        .filter((rule) => rule.annotations[Annotation.dashboardUID] === dashboard.uid &&
        rule.annotations[Annotation.panelID] === String(panel.id)), [combinedNamespaces, dashboard, panel]);
    return {
        rules,
        errors,
        loading,
    };
}
//# sourceMappingURL=usePanelCombinedRules.js.map