import { useDispatch } from 'react-redux';
import { fetchPromRulesAction, fetchRulerRulesAction } from '../state/actions';
import { Annotation, RULE_LIST_POLL_INTERVAL_MS } from '../utils/constants';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { initialAsyncRequestState } from '../utils/redux';
import { useCombinedRuleNamespaces } from './useCombinedRuleNamespaces';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
import { useEffect, useMemo } from 'react';
export function usePanelCombinedRules(_a) {
    var _b, _c;
    var dashboard = _a.dashboard, panel = _a.panel, _d = _a.poll, poll = _d === void 0 ? false : _d;
    var dispatch = useDispatch();
    var promRuleRequest = (_b = useUnifiedAlertingSelector(function (state) { return state.promRules[GRAFANA_RULES_SOURCE_NAME]; })) !== null && _b !== void 0 ? _b : initialAsyncRequestState;
    var rulerRuleRequest = (_c = useUnifiedAlertingSelector(function (state) { return state.rulerRules[GRAFANA_RULES_SOURCE_NAME]; })) !== null && _c !== void 0 ? _c : initialAsyncRequestState;
    // fetch rules, then poll every RULE_LIST_POLL_INTERVAL_MS
    useEffect(function () {
        var fetch = function () {
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
            var interval_1 = setInterval(fetch, RULE_LIST_POLL_INTERVAL_MS);
            return function () {
                clearInterval(interval_1);
            };
        }
        return function () { };
    }, [dispatch, poll, panel.id, dashboard.uid]);
    var loading = promRuleRequest.loading || rulerRuleRequest.loading;
    var errors = [promRuleRequest.error, rulerRuleRequest.error].filter(function (err) { return !!err; });
    var combinedNamespaces = useCombinedRuleNamespaces(GRAFANA_RULES_SOURCE_NAME);
    // filter out rules that are relevant to this panel
    var rules = useMemo(function () {
        return combinedNamespaces
            .flatMap(function (ns) { return ns.groups; })
            .flatMap(function (group) { return group.rules; })
            .filter(function (rule) {
            return rule.annotations[Annotation.dashboardUID] === dashboard.uid &&
                rule.annotations[Annotation.panelID] === String(panel.id);
        });
    }, [combinedNamespaces, dashboard, panel]);
    return {
        rules: rules,
        errors: errors,
        loading: loading,
    };
}
//# sourceMappingURL=usePanelCombinedRules.js.map