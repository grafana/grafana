import { __assign, __makeTemplateObject } from "tslib";
import React, { useMemo } from 'react';
import { css, cx } from '@emotion/css';
import { useDispatch } from 'react-redux';
import { Button, Field, FieldArray, Form, Icon, Input, Modal, useStyles2 } from '@grafana/ui';
import { addExternalAlertmanagersAction } from '../../state/actions';
export var AddAlertManagerModal = function (_a) {
    var alertmanagers = _a.alertmanagers, onClose = _a.onClose;
    var styles = useStyles2(getStyles);
    var dispatch = useDispatch();
    var defaultValues = useMemo(function () { return ({
        alertmanagers: alertmanagers,
    }); }, [alertmanagers]);
    var modalTitle = (React.createElement("div", { className: styles.modalTitle },
        React.createElement(Icon, { name: "bell", className: styles.modalIcon }),
        React.createElement("h3", null, "Add Alertmanager")));
    var onSubmit = function (values) {
        dispatch(addExternalAlertmanagersAction(values.alertmanagers.map(function (am) { return cleanAlertmanagerUrl(am.url); })));
        onClose();
    };
    return (React.createElement(Modal, { title: modalTitle, isOpen: true, onDismiss: onClose, className: styles.modal },
        React.createElement("div", { className: styles.description }, "We use a service discovery method to find existing Alertmanagers for a given URL."),
        React.createElement(Form, { onSubmit: onSubmit, defaultValues: defaultValues }, function (_a) {
            var register = _a.register, control = _a.control, errors = _a.errors;
            return (React.createElement("div", null,
                React.createElement(FieldArray, { control: control, name: "alertmanagers" }, function (_a) {
                    var fields = _a.fields, append = _a.append, remove = _a.remove;
                    return (React.createElement("div", { className: styles.fieldArray },
                        React.createElement("div", { className: styles.bold }, "Source url"),
                        React.createElement("div", { className: styles.muted }, "Auth can be done via URL, eg. user:password@url"),
                        fields.map(function (field, index) {
                            var _a;
                            return (React.createElement(Field, { invalid: !!((_a = errors === null || errors === void 0 ? void 0 : errors.alertmanagers) === null || _a === void 0 ? void 0 : _a[index]), error: "Field is required", key: field.id + "-" + index },
                                React.createElement(Input, __assign({ className: styles.input, defaultValue: field.url }, register("alertmanagers." + index + ".url", { required: true }), { placeholder: "admin:admin@some.url.dev", addonAfter: React.createElement(Button, { "aria-label": "Remove alertmanager", type: "button", onClick: function () { return remove(index); }, variant: "destructive", className: styles.destroyInputRow },
                                        React.createElement(Icon, { name: "trash-alt" })) }))));
                        }),
                        React.createElement(Button, { type: "button", variant: "secondary", onClick: function () { return append({ url: '' }); } }, "Add URL")));
                }),
                React.createElement("div", null,
                    React.createElement(Button, { onSubmit: function () { return onSubmit; } }, "Add Alertmanagers"))));
        })));
};
function cleanAlertmanagerUrl(url) {
    return url.replace(/\/$/, '').replace(/\/api\/v[1|2]\/alerts/i, '');
}
var getStyles = function (theme) {
    var muted = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.text.secondary);
    return {
        description: cx(css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n        margin-bottom: ", ";\n      "], ["\n        margin-bottom: ", ";\n      "])), theme.spacing(2)), muted),
        muted: muted,
        bold: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      font-weight: ", ";\n    "], ["\n      font-weight: ", ";\n    "])), theme.typography.fontWeightBold),
        modal: css(templateObject_4 || (templateObject_4 = __makeTemplateObject([""], [""]))),
        modalIcon: cx(muted, css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n        margin-right: ", ";\n      "], ["\n        margin-right: ", ";\n      "])), theme.spacing(1))),
        modalTitle: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      display: flex;\n    "], ["\n      display: flex;\n    "]))),
        input: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      margin-bottom: ", ";\n      margin-right: ", ";\n    "], ["\n      margin-bottom: ", ";\n      margin-right: ", ";\n    "])), theme.spacing(1), theme.spacing(1)),
        inputRow: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      display: flex;\n    "], ["\n      display: flex;\n    "]))),
        destroyInputRow: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      padding: ", ";\n    "], ["\n      padding: ", ";\n    "])), theme.spacing(1)),
        fieldArray: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing(4)),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10;
//# sourceMappingURL=AddAlertManagerModal.js.map