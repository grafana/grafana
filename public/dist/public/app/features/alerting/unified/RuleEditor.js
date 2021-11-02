import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { Alert, LinkButton, LoadingPlaceholder, useStyles2, withErrorBoundary } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { useCleanup } from 'app/core/hooks/useCleanup';
import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AlertRuleForm } from './components/rule-editor/AlertRuleForm';
import { useIsRuleEditable } from './hooks/useIsRuleEditable';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchEditableRuleAction } from './state/actions';
import * as ruleId from './utils/rule-id';
var ExistingRuleEditor = function (_a) {
    var identifier = _a.identifier;
    useCleanup(function (state) { return state.unifiedAlerting.ruleForm.existingRule; });
    var _b = useUnifiedAlertingSelector(function (state) { return state.ruleForm.existingRule; }), loading = _b.loading, result = _b.result, error = _b.error, dispatched = _b.dispatched;
    var dispatch = useDispatch();
    var isEditable = useIsRuleEditable(ruleId.ruleIdentifierToRuleSourceName(identifier), result === null || result === void 0 ? void 0 : result.rule).isEditable;
    useEffect(function () {
        if (!dispatched) {
            dispatch(fetchEditableRuleAction(identifier));
        }
    }, [dispatched, dispatch, identifier]);
    if (loading || isEditable === undefined) {
        return (React.createElement(Page.Contents, null,
            React.createElement(LoadingPlaceholder, { text: "Loading rule..." })));
    }
    if (error) {
        return (React.createElement(Page.Contents, null,
            React.createElement(Alert, { severity: "error", title: "Failed to load rule" }, error.message)));
    }
    if (!result) {
        return React.createElement(AlertWarning, { title: "Rule not found" }, "Sorry! This rule does not exist.");
    }
    if (isEditable === false) {
        return React.createElement(AlertWarning, { title: "Cannot edit rule" }, "Sorry! You do not have permission to edit this rule.");
    }
    return React.createElement(AlertRuleForm, { existing: result });
};
var RuleEditor = function (_a) {
    var match = _a.match;
    var id = match.params.id;
    var identifier = ruleId.tryParse(id, true);
    if (identifier) {
        return React.createElement(ExistingRuleEditor, { key: id, identifier: identifier });
    }
    if (!(contextSrv.hasEditPermissionInFolders || contextSrv.isEditor)) {
        return React.createElement(AlertWarning, { title: "Cannot create rules" }, "Sorry! You are not allowed to create rules.");
    }
    return React.createElement(AlertRuleForm, null);
};
var AlertWarning = function (_a) {
    var title = _a.title, children = _a.children;
    return (React.createElement(Alert, { className: useStyles2(warningStyles).warning, severity: "warning", title: title },
        React.createElement("p", null, children),
        React.createElement(LinkButton, { href: "alerting/list" }, "To rule list")));
};
var warningStyles = function (theme) { return ({
    warning: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin: ", ";\n  "], ["\n    margin: ", ";\n  "])), theme.spacing(4)),
}); };
export default withErrorBoundary(RuleEditor, { style: 'page' });
var templateObject_1;
//# sourceMappingURL=RuleEditor.js.map