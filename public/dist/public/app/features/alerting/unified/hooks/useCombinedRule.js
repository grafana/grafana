import { __assign, __values } from "tslib";
import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { initialAsyncRequestState } from '../utils/redux';
import { useCombinedRuleNamespaces } from './useCombinedRuleNamespaces';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
import { fetchPromRulesAction, fetchRulerRulesAction } from '../state/actions';
import * as ruleId from '../utils/rule-id';
import { isRulerNotSupportedResponse } from '../utils/rules';
export function useCombinedRule(identifier, ruleSourceName) {
    var requestState = useCombinedRulesLoader(ruleSourceName);
    var combinedRules = useCombinedRuleNamespaces(ruleSourceName);
    var rule = useMemo(function () {
        var e_1, _a, e_2, _b, e_3, _c;
        if (!identifier || !ruleSourceName || combinedRules.length === 0) {
            return;
        }
        try {
            for (var combinedRules_1 = __values(combinedRules), combinedRules_1_1 = combinedRules_1.next(); !combinedRules_1_1.done; combinedRules_1_1 = combinedRules_1.next()) {
                var namespace = combinedRules_1_1.value;
                try {
                    for (var _d = (e_2 = void 0, __values(namespace.groups)), _e = _d.next(); !_e.done; _e = _d.next()) {
                        var group = _e.value;
                        try {
                            for (var _f = (e_3 = void 0, __values(group.rules)), _g = _f.next(); !_g.done; _g = _f.next()) {
                                var rule_1 = _g.value;
                                var id = ruleId.fromCombinedRule(ruleSourceName, rule_1);
                                if (ruleId.equal(id, identifier)) {
                                    return rule_1;
                                }
                            }
                        }
                        catch (e_3_1) { e_3 = { error: e_3_1 }; }
                        finally {
                            try {
                                if (_g && !_g.done && (_c = _f.return)) _c.call(_f);
                            }
                            finally { if (e_3) throw e_3.error; }
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_e && !_e.done && (_b = _d.return)) _b.call(_d);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (combinedRules_1_1 && !combinedRules_1_1.done && (_a = combinedRules_1.return)) _a.call(combinedRules_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return;
    }, [identifier, ruleSourceName, combinedRules]);
    return __assign(__assign({}, requestState), { result: rule });
}
export function useCombinedRulesMatching(ruleName, ruleSourceName) {
    var requestState = useCombinedRulesLoader(ruleSourceName);
    var combinedRules = useCombinedRuleNamespaces(ruleSourceName);
    var rules = useMemo(function () {
        var e_4, _a, e_5, _b, e_6, _c;
        if (!ruleName || !ruleSourceName || combinedRules.length === 0) {
            return [];
        }
        var rules = [];
        try {
            for (var combinedRules_2 = __values(combinedRules), combinedRules_2_1 = combinedRules_2.next(); !combinedRules_2_1.done; combinedRules_2_1 = combinedRules_2.next()) {
                var namespace = combinedRules_2_1.value;
                try {
                    for (var _d = (e_5 = void 0, __values(namespace.groups)), _e = _d.next(); !_e.done; _e = _d.next()) {
                        var group = _e.value;
                        try {
                            for (var _f = (e_6 = void 0, __values(group.rules)), _g = _f.next(); !_g.done; _g = _f.next()) {
                                var rule = _g.value;
                                if (rule.name === ruleName) {
                                    rules.push(rule);
                                }
                            }
                        }
                        catch (e_6_1) { e_6 = { error: e_6_1 }; }
                        finally {
                            try {
                                if (_g && !_g.done && (_c = _f.return)) _c.call(_f);
                            }
                            finally { if (e_6) throw e_6.error; }
                        }
                    }
                }
                catch (e_5_1) { e_5 = { error: e_5_1 }; }
                finally {
                    try {
                        if (_e && !_e.done && (_b = _d.return)) _b.call(_d);
                    }
                    finally { if (e_5) throw e_5.error; }
                }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (combinedRules_2_1 && !combinedRules_2_1.done && (_a = combinedRules_2.return)) _a.call(combinedRules_2);
            }
            finally { if (e_4) throw e_4.error; }
        }
        return rules;
    }, [ruleName, ruleSourceName, combinedRules]);
    return __assign(__assign({}, requestState), { result: rules });
}
function useCombinedRulesLoader(rulesSourceName) {
    var _a;
    var dispatch = useDispatch();
    var promRuleRequests = useUnifiedAlertingSelector(function (state) { return state.promRules; });
    var promRuleRequest = getRequestState(rulesSourceName, promRuleRequests);
    var rulerRuleRequests = useUnifiedAlertingSelector(function (state) { return state.rulerRules; });
    var rulerRuleRequest = getRequestState(rulesSourceName, rulerRuleRequests);
    useEffect(function () {
        if (!rulesSourceName) {
            return;
        }
        dispatch(fetchPromRulesAction({ rulesSourceName: rulesSourceName }));
        dispatch(fetchRulerRulesAction({ rulesSourceName: rulesSourceName }));
    }, [dispatch, rulesSourceName]);
    return {
        loading: promRuleRequest.loading || rulerRuleRequest.loading,
        error: ((_a = promRuleRequest.error) !== null && _a !== void 0 ? _a : isRulerNotSupportedResponse(rulerRuleRequest)) ? undefined : rulerRuleRequest.error,
        dispatched: promRuleRequest.dispatched && rulerRuleRequest.dispatched,
    };
}
function getRequestState(ruleSourceName, slice) {
    if (!ruleSourceName) {
        return initialAsyncRequestState;
    }
    var state = slice[ruleSourceName];
    if (!state) {
        return initialAsyncRequestState;
    }
    return state;
}
//# sourceMappingURL=useCombinedRule.js.map