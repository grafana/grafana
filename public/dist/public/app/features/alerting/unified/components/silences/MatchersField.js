import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { Button, Field, Input, IconButton, InputControl, useStyles2, Select } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';
import { matcherFieldOptions } from '../../utils/alertmanager';
var MatchersField = function (_a) {
    var className = _a.className;
    var styles = useStyles2(getStyles);
    var formApi = useFormContext();
    var control = formApi.control, register = formApi.register, errors = formApi.formState.errors;
    var _b = useFieldArray({ name: 'matchers' }), _c = _b.fields, matchers = _c === void 0 ? [] : _c, append = _b.append, remove = _b.remove;
    return (React.createElement("div", { className: cx(className, styles.wrapper) },
        React.createElement(Field, { label: "Matching labels", required: true },
            React.createElement("div", null,
                React.createElement("div", { className: styles.matchers }, matchers.map(function (matcher, index) {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                    return (React.createElement("div", { className: styles.row, key: "" + matcher.id, "data-testid": "matcher" },
                        React.createElement(Field, { label: "Label", invalid: !!((_b = (_a = errors === null || errors === void 0 ? void 0 : errors.matchers) === null || _a === void 0 ? void 0 : _a[index]) === null || _b === void 0 ? void 0 : _b.name), error: (_e = (_d = (_c = errors === null || errors === void 0 ? void 0 : errors.matchers) === null || _c === void 0 ? void 0 : _c[index]) === null || _d === void 0 ? void 0 : _d.name) === null || _e === void 0 ? void 0 : _e.message },
                            React.createElement(Input, __assign({}, register("matchers." + index + ".name", {
                                required: { value: true, message: 'Required.' },
                            }), { defaultValue: matcher.name, placeholder: "label" }))),
                        React.createElement(Field, { label: 'Operator' },
                            React.createElement(InputControl, { control: control, render: function (_a) {
                                    var _b = _a.field, onChange = _b.onChange, ref = _b.ref, field = __rest(_b, ["onChange", "ref"]);
                                    return (React.createElement(Select, __assign({}, field, { menuShouldPortal: true, onChange: function (value) { return onChange(value.value); }, className: styles.matcherOptions, options: matcherFieldOptions, "aria-label": "operator" })));
                                }, defaultValue: matcher.operator || matcherFieldOptions[0].value, name: "matchers." + index + ".operator", rules: { required: { value: true, message: 'Required.' } } })),
                        React.createElement(Field, { label: "Value", invalid: !!((_g = (_f = errors === null || errors === void 0 ? void 0 : errors.matchers) === null || _f === void 0 ? void 0 : _f[index]) === null || _g === void 0 ? void 0 : _g.value), error: (_k = (_j = (_h = errors === null || errors === void 0 ? void 0 : errors.matchers) === null || _h === void 0 ? void 0 : _h[index]) === null || _j === void 0 ? void 0 : _j.value) === null || _k === void 0 ? void 0 : _k.message },
                            React.createElement(Input, __assign({}, register("matchers." + index + ".value", {
                                required: { value: true, message: 'Required.' },
                            }), { defaultValue: matcher.value, placeholder: "value" }))),
                        matchers.length > 1 && (React.createElement(IconButton, { className: styles.removeButton, tooltip: "Remove matcher", name: 'trash-alt', onClick: function () { return remove(index); } }, "Remove"))));
                })),
                React.createElement(Button, { type: "button", icon: "plus", variant: "secondary", onClick: function () {
                        var newMatcher = { name: '', value: '', operator: MatcherOperator.equal };
                        append(newMatcher);
                    } }, "Add matcher")))));
};
var getStyles = function (theme) {
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-top: ", ";\n    "], ["\n      margin-top: ", ";\n    "])), theme.spacing(2)),
        row: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      align-items: flex-start;\n      flex-direction: row;\n      background-color: ", ";\n      padding: ", " ", " 0 ", ";\n      & > * + * {\n        margin-left: ", ";\n      }\n    "], ["\n      display: flex;\n      align-items: flex-start;\n      flex-direction: row;\n      background-color: ", ";\n      padding: ", " ", " 0 ", ";\n      & > * + * {\n        margin-left: ", ";\n      }\n    "])), theme.colors.background.secondary, theme.spacing(1), theme.spacing(1), theme.spacing(1), theme.spacing(2)),
        removeButton: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      margin-left: ", ";\n      margin-top: ", ";\n    "], ["\n      margin-left: ", ";\n      margin-top: ", ";\n    "])), theme.spacing(1), theme.spacing(2.5)),
        matcherOptions: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      min-width: 140px;\n    "], ["\n      min-width: 140px;\n    "]))),
        matchers: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      max-width: 585px;\n      margin: ", " 0;\n      padding-top: ", ";\n    "], ["\n      max-width: 585px;\n      margin: ", " 0;\n      padding-top: ", ";\n    "])), theme.spacing(1), theme.spacing(0.5)),
    };
};
export default MatchersField;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=MatchersField.js.map