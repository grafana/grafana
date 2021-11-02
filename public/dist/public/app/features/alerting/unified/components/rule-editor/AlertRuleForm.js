import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useMemo } from 'react';
import { AppEvents } from '@grafana/data';
import { PageToolbar, Button, useStyles2, CustomScrollbar, Spinner } from '@grafana/ui';
import { css } from '@emotion/css';
import { AlertTypeStep } from './AlertTypeStep';
import { DetailsStep } from './DetailsStep';
import { QueryStep } from './QueryStep';
import { useForm, FormProvider } from 'react-hook-form';
import { RuleFormType } from '../../types/rule-form';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { initialAsyncRequestState } from '../../utils/redux';
import { saveRuleFormAction } from '../../state/actions';
import { useDispatch } from 'react-redux';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { rulerRuleToFormValues, getDefaultFormValues, getDefaultQueries } from '../../utils/rule-form';
import { Link } from 'react-router-dom';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { appEvents } from 'app/core/core';
import { CloudConditionsStep } from './CloudConditionsStep';
import { GrafanaConditionsStep } from './GrafanaConditionsStep';
export var AlertRuleForm = function (_a) {
    var _b;
    var existing = _a.existing;
    var styles = useStyles2(getStyles);
    var dispatch = useDispatch();
    var _c = __read(useQueryParams(), 1), queryParams = _c[0];
    var returnTo = (_b = queryParams['returnTo']) !== null && _b !== void 0 ? _b : '/alerting/list';
    var defaultValues = useMemo(function () {
        if (existing) {
            return rulerRuleToFormValues(existing);
        }
        return __assign(__assign(__assign({}, getDefaultFormValues()), { queries: getDefaultQueries() }), (queryParams['defaults'] ? JSON.parse(queryParams['defaults']) : {}));
    }, [existing, queryParams]);
    var formAPI = useForm({
        mode: 'onSubmit',
        defaultValues: defaultValues,
        shouldFocusError: true,
    });
    var handleSubmit = formAPI.handleSubmit, watch = formAPI.watch;
    var type = watch('type');
    var dataSourceName = watch('dataSourceName');
    var showStep2 = Boolean(type && (type === RuleFormType.grafana || !!dataSourceName));
    var submitState = useUnifiedAlertingSelector(function (state) { return state.ruleForm.saveRule; }) || initialAsyncRequestState;
    useCleanup(function (state) { return state.unifiedAlerting.ruleForm.saveRule; });
    var submit = function (values, exitOnSave) {
        var _a, _b, _c, _d;
        dispatch(saveRuleFormAction({
            values: __assign(__assign(__assign({}, defaultValues), values), { annotations: (_b = (_a = values.annotations) === null || _a === void 0 ? void 0 : _a.map(function (_a) {
                    var key = _a.key, value = _a.value;
                    return ({ key: key.trim(), value: value.trim() });
                }).filter(function (_a) {
                    var key = _a.key, value = _a.value;
                    return !!key && !!value;
                })) !== null && _b !== void 0 ? _b : [], labels: (_d = (_c = values.labels) === null || _c === void 0 ? void 0 : _c.map(function (_a) {
                    var key = _a.key, value = _a.value;
                    return ({ key: key.trim(), value: value.trim() });
                }).filter(function (_a) {
                    var key = _a.key;
                    return !!key;
                })) !== null && _d !== void 0 ? _d : [] }),
            existing: existing,
            redirectOnSave: exitOnSave ? returnTo : undefined,
        }));
    };
    var onInvalid = function () {
        appEvents.emit(AppEvents.alertError, ['There are errors in the form. Please correct them and try again!']);
    };
    return (React.createElement(FormProvider, __assign({}, formAPI),
        React.createElement("form", { onSubmit: function (e) { return e.preventDefault(); }, className: styles.form },
            React.createElement(PageToolbar, { title: "Create alert rule", pageIcon: "bell" },
                React.createElement(Link, { to: returnTo },
                    React.createElement(Button, { variant: "secondary", disabled: submitState.loading, type: "button", fill: "outline" }, "Cancel")),
                React.createElement(Button, { variant: "secondary", type: "button", onClick: handleSubmit(function (values) { return submit(values, false); }, onInvalid), disabled: submitState.loading },
                    submitState.loading && React.createElement(Spinner, { className: styles.buttonSpinner, inline: true }),
                    "Save"),
                React.createElement(Button, { variant: "primary", type: "button", onClick: handleSubmit(function (values) { return submit(values, true); }, onInvalid), disabled: submitState.loading },
                    submitState.loading && React.createElement(Spinner, { className: styles.buttonSpinner, inline: true }),
                    "Save and exit")),
            React.createElement("div", { className: styles.contentOuter },
                React.createElement(CustomScrollbar, { autoHeightMin: "100%", hideHorizontalTrack: true },
                    React.createElement("div", { className: styles.contentInner },
                        React.createElement(AlertTypeStep, { editingExistingRule: !!existing }),
                        showStep2 && (React.createElement(React.Fragment, null,
                            React.createElement(QueryStep, null),
                            type === RuleFormType.grafana ? React.createElement(GrafanaConditionsStep, null) : React.createElement(CloudConditionsStep, null),
                            React.createElement(DetailsStep, null)))))))));
};
var getStyles = function (theme) {
    return {
        buttonSpinner: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-right: ", ";\n    "], ["\n      margin-right: ", ";\n    "])), theme.spacing(1)),
        form: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      width: 100%;\n      height: 100%;\n      display: flex;\n      flex-direction: column;\n    "], ["\n      width: 100%;\n      height: 100%;\n      display: flex;\n      flex-direction: column;\n    "]))),
        contentInner: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      flex: 1;\n      padding: ", ";\n    "], ["\n      flex: 1;\n      padding: ", ";\n    "])), theme.spacing(2)),
        contentOuter: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      background: ", ";\n      border: 1px solid ", ";\n      border-radius: ", ";\n      margin: ", ";\n      overflow: hidden;\n      flex: 1;\n    "], ["\n      background: ", ";\n      border: 1px solid ", ";\n      border-radius: ", ";\n      margin: ", ";\n      overflow: hidden;\n      flex: 1;\n    "])), theme.colors.background.primary, theme.colors.border.weak, theme.shape.borderRadius(), theme.spacing(0, 2, 2)),
        flexRow: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: row;\n      justify-content: flex-start;\n    "], ["\n      display: flex;\n      flex-direction: row;\n      justify-content: flex-start;\n    "]))),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=AlertRuleForm.js.map