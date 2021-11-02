import { __assign, __makeTemplateObject } from "tslib";
import React from 'react';
import { Button, Field, FieldArray, Input, InlineLabel, Label, useStyles } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { useFormContext } from 'react-hook-form';
var LabelsField = function (_a) {
    var className = _a.className;
    var styles = useStyles(getStyles);
    var _b = useFormContext(), register = _b.register, control = _b.control, watch = _b.watch, errors = _b.formState.errors;
    var labels = watch('labels');
    return (React.createElement("div", { className: cx(className, styles.wrapper) },
        React.createElement(Label, null, "Custom Labels"),
        React.createElement(FieldArray, { control: control, name: "labels" }, function (_a) {
            var fields = _a.fields, append = _a.append, remove = _a.remove;
            return (React.createElement(React.Fragment, null,
                React.createElement("div", { className: styles.flexRow },
                    React.createElement(InlineLabel, { width: 18 }, "Labels"),
                    React.createElement("div", { className: styles.flexColumn },
                        fields.map(function (field, index) {
                            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
                            return (React.createElement("div", { key: field.id },
                                React.createElement("div", { className: cx(styles.flexRow, styles.centerAlignRow) },
                                    React.createElement(Field, { className: styles.labelInput, invalid: !!((_c = (_b = (_a = errors.labels) === null || _a === void 0 ? void 0 : _a[index]) === null || _b === void 0 ? void 0 : _b.key) === null || _c === void 0 ? void 0 : _c.message), error: (_f = (_e = (_d = errors.labels) === null || _d === void 0 ? void 0 : _d[index]) === null || _e === void 0 ? void 0 : _e.key) === null || _f === void 0 ? void 0 : _f.message },
                                        React.createElement(Input, __assign({}, register("labels[" + index + "].key", {
                                            required: { value: !!((_g = labels[index]) === null || _g === void 0 ? void 0 : _g.value), message: 'Required.' },
                                        }), { placeholder: "key", "data-testid": "label-key-" + index, defaultValue: field.key }))),
                                    React.createElement(InlineLabel, { className: styles.equalSign }, "="),
                                    React.createElement(Field, { className: styles.labelInput, invalid: !!((_k = (_j = (_h = errors.labels) === null || _h === void 0 ? void 0 : _h[index]) === null || _j === void 0 ? void 0 : _j.value) === null || _k === void 0 ? void 0 : _k.message), error: (_o = (_m = (_l = errors.labels) === null || _l === void 0 ? void 0 : _l[index]) === null || _m === void 0 ? void 0 : _m.value) === null || _o === void 0 ? void 0 : _o.message },
                                        React.createElement(Input, __assign({}, register("labels[" + index + "].value", {
                                            required: { value: !!((_p = labels[index]) === null || _p === void 0 ? void 0 : _p.key), message: 'Required.' },
                                        }), { placeholder: "value", "data-testid": "label-value-" + index, defaultValue: field.value }))),
                                    React.createElement(Button, { className: styles.deleteLabelButton, "aria-label": "delete label", icon: "trash-alt", variant: "secondary", onClick: function () {
                                            remove(index);
                                        } }))));
                        }),
                        React.createElement(Button, { className: styles.addLabelButton, icon: "plus-circle", type: "button", variant: "secondary", onClick: function () {
                                append({});
                            } }, "Add label")))));
        })));
};
var getStyles = function (theme) {
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-top: ", ";\n    "], ["\n      margin-top: ", ";\n    "])), theme.spacing.md),
        flexColumn: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n    "], ["\n      display: flex;\n      flex-direction: column;\n    "]))),
        flexRow: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: row;\n      justify-content: flex-start;\n\n      & + button {\n        margin-left: ", ";\n      }\n    "], ["\n      display: flex;\n      flex-direction: row;\n      justify-content: flex-start;\n\n      & + button {\n        margin-left: ", ";\n      }\n    "])), theme.spacing.xs),
        deleteLabelButton: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      margin-left: ", ";\n      align-self: flex-start;\n    "], ["\n      margin-left: ", ";\n      align-self: flex-start;\n    "])), theme.spacing.xs),
        addLabelButton: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      flex-grow: 0;\n      align-self: flex-start;\n    "], ["\n      flex-grow: 0;\n      align-self: flex-start;\n    "]))),
        centerAlignRow: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      align-items: baseline;\n    "], ["\n      align-items: baseline;\n    "]))),
        equalSign: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      align-self: flex-start;\n      width: 28px;\n      justify-content: center;\n      margin-left: ", ";\n    "], ["\n      align-self: flex-start;\n      width: 28px;\n      justify-content: center;\n      margin-left: ", ";\n    "])), theme.spacing.xs),
        labelInput: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      width: 183px;\n      margin-bottom: ", ";\n      & + & {\n        margin-left: ", ";\n      }\n    "], ["\n      width: 183px;\n      margin-bottom: ", ";\n      & + & {\n        margin-left: ", ";\n      }\n    "])), theme.spacing.sm, theme.spacing.sm),
    };
};
export default LabelsField;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8;
//# sourceMappingURL=LabelsField.js.map