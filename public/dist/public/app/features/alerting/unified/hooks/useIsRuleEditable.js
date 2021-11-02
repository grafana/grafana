import { contextSrv } from 'app/core/services/context_srv';
import { isGrafanaRulerRule } from '../utils/rules';
import { useFolder } from './useFolder';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
import { useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { checkIfLotexSupportsEditingRulesAction } from '../state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
export function useIsRuleEditable(rulesSourceName, rule) {
    var _a, _b;
    var checkEditingRequests = useUnifiedAlertingSelector(function (state) { return state.lotexSupportsRuleEditing; });
    var dispatch = useDispatch();
    var folderUID = rule && isGrafanaRulerRule(rule) ? rule.grafana_alert.namespace_uid : undefined;
    var _c = useFolder(folderUID), folder = _c.folder, loading = _c.loading;
    useEffect(function () {
        if (checkEditingRequests[rulesSourceName] === undefined && rulesSourceName !== GRAFANA_RULES_SOURCE_NAME) {
            dispatch(checkIfLotexSupportsEditingRulesAction(rulesSourceName));
        }
    }, [rulesSourceName, checkEditingRequests, dispatch]);
    if (!rule) {
        return { isEditable: false, loading: false };
    }
    // grafana rules can be edited if user can edit the folder they're in
    if (isGrafanaRulerRule(rule)) {
        if (!folderUID) {
            throw new Error("Rule " + rule.grafana_alert.title + " does not have a folder uid, cannot determine if it is editable.");
        }
        return {
            isEditable: folder === null || folder === void 0 ? void 0 : folder.canSave,
            loading: loading,
        };
    }
    // prom rules are only editable by users with Editor role and only if rules source supports editing
    return {
        isEditable: contextSrv.isEditor && !!((_a = checkEditingRequests[rulesSourceName]) === null || _a === void 0 ? void 0 : _a.result),
        loading: !!((_b = checkEditingRequests[rulesSourceName]) === null || _b === void 0 ? void 0 : _b.loading),
    };
}
//# sourceMappingURL=useIsRuleEditable.js.map