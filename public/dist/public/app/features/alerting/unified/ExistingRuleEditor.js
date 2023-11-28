import React, { useEffect } from 'react';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { useDispatch } from 'app/types';
import { AlertWarning } from './AlertWarning';
import { AlertRuleForm } from './components/rule-editor/alert-rule-form/AlertRuleForm';
import { useIsRuleEditable } from './hooks/useIsRuleEditable';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchEditableRuleAction } from './state/actions';
import { initialAsyncRequestState } from './utils/redux';
import * as ruleId from './utils/rule-id';
export function ExistingRuleEditor({ identifier, id }) {
    useCleanup((state) => (state.unifiedAlerting.ruleForm.existingRule = initialAsyncRequestState));
    const { loading: loadingAlertRule, result, error, dispatched, } = useUnifiedAlertingSelector((state) => state.ruleForm.existingRule);
    const dispatch = useDispatch();
    const { isEditable, loading: loadingEditable } = useIsRuleEditable(ruleId.ruleIdentifierToRuleSourceName(identifier), result === null || result === void 0 ? void 0 : result.rule);
    const loading = loadingAlertRule || loadingEditable;
    useEffect(() => {
        if (!dispatched) {
            dispatch(fetchEditableRuleAction(identifier));
        }
    }, [dispatched, dispatch, identifier]);
    if (loading || isEditable === undefined) {
        return React.createElement(LoadingPlaceholder, { text: "Loading rule..." });
    }
    if (error) {
        return (React.createElement(Alert, { severity: "error", title: "Failed to load rule" }, error.message));
    }
    if (!result) {
        return React.createElement(AlertWarning, { title: "Rule not found" }, "Sorry! This rule does not exist.");
    }
    if (isEditable === false) {
        return React.createElement(AlertWarning, { title: "Cannot edit rule" }, "Sorry! You do not have permission to edit this rule.");
    }
    return React.createElement(AlertRuleForm, { existing: result });
}
//# sourceMappingURL=ExistingRuleEditor.js.map