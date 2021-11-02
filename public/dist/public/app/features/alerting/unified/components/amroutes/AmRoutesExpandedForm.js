import { __assign, __makeTemplateObject, __read, __rest, __spreadArray } from "tslib";
import React, { useState } from 'react';
import { css, cx } from '@emotion/css';
import { Button, Field, FieldArray, Form, HorizontalGroup, IconButton, Input, InputControl, MultiSelect, Select, Switch, useStyles2, } from '@grafana/ui';
import { emptyArrayFieldMatcher, mapMultiSelectValueToStrings, mapSelectValueToString, optionalPositiveInteger, stringToSelectableValue, stringsToSelectableValues, } from '../../utils/amroutes';
import { timeOptions } from '../../utils/time';
import { getFormStyles } from './formStyles';
import { matcherFieldOptions } from '../../utils/alertmanager';
export var AmRoutesExpandedForm = function (_a) {
    var onCancel = _a.onCancel, onSave = _a.onSave, receivers = _a.receivers, routes = _a.routes;
    var styles = useStyles2(getStyles);
    var formStyles = useStyles2(getFormStyles);
    var _b = __read(useState(routes.groupBy.length > 0), 2), overrideGrouping = _b[0], setOverrideGrouping = _b[1];
    var _c = __read(useState(!!routes.groupWaitValue || !!routes.groupIntervalValue || !!routes.repeatIntervalValue), 2), overrideTimings = _c[0], setOverrideTimings = _c[1];
    var _d = __read(useState(stringsToSelectableValues(routes.groupBy)), 2), groupByOptions = _d[0], setGroupByOptions = _d[1];
    return (React.createElement(Form, { defaultValues: routes, onSubmit: onSave }, function (_a) {
        var _b, _c, _d;
        var control = _a.control, register = _a.register, errors = _a.errors, setValue = _a.setValue;
        return (React.createElement(React.Fragment, null,
            React.createElement("input", __assign({ type: "hidden" }, register('id'))),
            React.createElement(FieldArray, { name: "object_matchers", control: control }, function (_a) {
                var fields = _a.fields, append = _a.append, remove = _a.remove;
                return (React.createElement(React.Fragment, null,
                    React.createElement("div", null, "Matching labels"),
                    React.createElement("div", { className: styles.matchersContainer }, fields.map(function (field, index) {
                        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                        var localPath = "object_matchers[" + index + "]";
                        return (React.createElement(HorizontalGroup, { key: field.id, align: "flex-start" },
                            React.createElement(Field, { label: "Label", invalid: !!((_b = (_a = errors.object_matchers) === null || _a === void 0 ? void 0 : _a[index]) === null || _b === void 0 ? void 0 : _b.name), error: (_e = (_d = (_c = errors.object_matchers) === null || _c === void 0 ? void 0 : _c[index]) === null || _d === void 0 ? void 0 : _d.name) === null || _e === void 0 ? void 0 : _e.message },
                                React.createElement(Input, __assign({}, register(localPath + ".name", { required: 'Field is required' }), { defaultValue: field.name, placeholder: "label" }))),
                            React.createElement(Field, { label: 'Operator' },
                                React.createElement(InputControl, { render: function (_a) {
                                        var _b = _a.field, onChange = _b.onChange, ref = _b.ref, field = __rest(_b, ["onChange", "ref"]);
                                        return (React.createElement(Select, __assign({}, field, { className: styles.matchersOperator, onChange: function (value) { return onChange(value === null || value === void 0 ? void 0 : value.value); }, options: matcherFieldOptions })));
                                    }, defaultValue: field.operator, control: control, name: localPath + ".operator", rules: { required: { value: true, message: 'Required.' } } })),
                            React.createElement(Field, { label: "Value", invalid: !!((_g = (_f = errors.object_matchers) === null || _f === void 0 ? void 0 : _f[index]) === null || _g === void 0 ? void 0 : _g.value), error: (_k = (_j = (_h = errors.object_matchers) === null || _h === void 0 ? void 0 : _h[index]) === null || _j === void 0 ? void 0 : _j.value) === null || _k === void 0 ? void 0 : _k.message },
                                React.createElement(Input, __assign({}, register(localPath + ".value", { required: 'Field is required' }), { defaultValue: field.value, placeholder: "value" }))),
                            React.createElement(IconButton, { className: styles.removeButton, tooltip: "Remove matcher", name: 'trash-alt', onClick: function () { return remove(index); } }, "Remove")));
                    })),
                    React.createElement(Button, { className: styles.addMatcherBtn, icon: "plus", onClick: function () { return append(emptyArrayFieldMatcher); }, variant: "secondary", type: "button" }, "Add matcher")));
            }),
            React.createElement(Field, { label: "Contact point" },
                React.createElement(InputControl, { render: function (_a) {
                        var _b = _a.field, onChange = _b.onChange, ref = _b.ref, field = __rest(_b, ["onChange", "ref"]);
                        return (React.createElement(Select, __assign({ menuShouldPortal: true }, field, { className: formStyles.input, onChange: function (value) { return onChange(mapSelectValueToString(value)); }, options: receivers })));
                    }, control: control, name: "receiver" })),
            React.createElement(Field, { label: "Continue matching subsequent sibling nodes" },
                React.createElement(Switch, __assign({}, register('continue')))),
            React.createElement(Field, { label: "Override grouping" },
                React.createElement(Switch, { value: overrideGrouping, onChange: function () { return setOverrideGrouping(function (overrideGrouping) { return !overrideGrouping; }); } })),
            overrideGrouping && (React.createElement(Field, { label: "Group by", description: "Group alerts when you receive a notification based on labels." },
                React.createElement(InputControl, { render: function (_a) {
                        var _b = _a.field, onChange = _b.onChange, ref = _b.ref, field = __rest(_b, ["onChange", "ref"]);
                        return (React.createElement(MultiSelect, __assign({ menuShouldPortal: true }, field, { allowCustomValue: true, className: formStyles.input, onCreateOption: function (opt) {
                                setGroupByOptions(function (opts) { return __spreadArray(__spreadArray([], __read(opts), false), [stringToSelectableValue(opt)], false); });
                                // @ts-ignore-check: react-hook-form made me do this
                                setValue('groupBy', __spreadArray(__spreadArray([], __read(field.value), false), [opt], false));
                            }, onChange: function (value) { return onChange(mapMultiSelectValueToStrings(value)); }, options: groupByOptions })));
                    }, control: control, name: "groupBy" }))),
            React.createElement(Field, { label: "Override general timings" },
                React.createElement(Switch, { value: overrideTimings, onChange: function () { return setOverrideTimings(function (overrideTimings) { return !overrideTimings; }); } })),
            overrideTimings && (React.createElement(React.Fragment, null,
                React.createElement(Field, { label: "Group wait", description: "The waiting time until the initial notification is sent for a new group created by an incoming alert.", invalid: !!errors.groupWaitValue, error: (_b = errors.groupWaitValue) === null || _b === void 0 ? void 0 : _b.message },
                    React.createElement(React.Fragment, null,
                        React.createElement("div", { className: cx(formStyles.container, formStyles.timingContainer) },
                            React.createElement(InputControl, { render: function (_a) {
                                    var field = _a.field, invalid = _a.fieldState.invalid;
                                    return (React.createElement(Input, __assign({}, field, { className: formStyles.smallInput, invalid: invalid, placeholder: "Time" })));
                                }, control: control, name: "groupWaitValue", rules: {
                                    validate: optionalPositiveInteger,
                                } }),
                            React.createElement(InputControl, { render: function (_a) {
                                    var _b = _a.field, onChange = _b.onChange, ref = _b.ref, field = __rest(_b, ["onChange", "ref"]);
                                    return (React.createElement(Select, __assign({ menuShouldPortal: true }, field, { className: formStyles.input, onChange: function (value) { return onChange(mapSelectValueToString(value)); }, options: timeOptions })));
                                }, control: control, name: "groupWaitValueType" })))),
                React.createElement(Field, { label: "Group interval", description: "The waiting time to send a batch of new alerts for that group after the first notification was sent.", invalid: !!errors.groupIntervalValue, error: (_c = errors.groupIntervalValue) === null || _c === void 0 ? void 0 : _c.message },
                    React.createElement(React.Fragment, null,
                        React.createElement("div", { className: cx(formStyles.container, formStyles.timingContainer) },
                            React.createElement(InputControl, { render: function (_a) {
                                    var field = _a.field, invalid = _a.fieldState.invalid;
                                    return (React.createElement(Input, __assign({}, field, { className: formStyles.smallInput, invalid: invalid, placeholder: "Time" })));
                                }, control: control, name: "groupIntervalValue", rules: {
                                    validate: optionalPositiveInteger,
                                } }),
                            React.createElement(InputControl, { render: function (_a) {
                                    var _b = _a.field, onChange = _b.onChange, ref = _b.ref, field = __rest(_b, ["onChange", "ref"]);
                                    return (React.createElement(Select, __assign({ menuShouldPortal: true }, field, { className: formStyles.input, onChange: function (value) { return onChange(mapSelectValueToString(value)); }, options: timeOptions })));
                                }, control: control, name: "groupIntervalValueType" })))),
                React.createElement(Field, { label: "Repeat interval", description: "The waiting time to resend an alert after they have successfully been sent.", invalid: !!errors.repeatIntervalValue, error: (_d = errors.repeatIntervalValue) === null || _d === void 0 ? void 0 : _d.message },
                    React.createElement(React.Fragment, null,
                        React.createElement("div", { className: cx(formStyles.container, formStyles.timingContainer) },
                            React.createElement(InputControl, { render: function (_a) {
                                    var field = _a.field, invalid = _a.fieldState.invalid;
                                    return (React.createElement(Input, __assign({}, field, { className: formStyles.smallInput, invalid: invalid, placeholder: "Time" })));
                                }, control: control, name: "repeatIntervalValue", rules: {
                                    validate: optionalPositiveInteger,
                                } }),
                            React.createElement(InputControl, { render: function (_a) {
                                    var _b = _a.field, onChange = _b.onChange, ref = _b.ref, field = __rest(_b, ["onChange", "ref"]);
                                    return (React.createElement(Select, __assign({ menuShouldPortal: true }, field, { className: formStyles.input, menuPlacement: "top", onChange: function (value) { return onChange(mapSelectValueToString(value)); }, options: timeOptions })));
                                }, control: control, name: "repeatIntervalValueType" })))))),
            React.createElement("div", { className: styles.buttonGroup },
                React.createElement(Button, { type: "submit" }, "Save policy"),
                React.createElement(Button, { onClick: onCancel, fill: "outline", type: "button", variant: "secondary" }, "Cancel"))));
    }));
};
var getStyles = function (theme) {
    var commonSpacing = theme.spacing(3.5);
    return {
        addMatcherBtn: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), commonSpacing),
        matchersContainer: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      background-color: ", ";\n      margin: ", ";\n      padding: ", ";\n      width: fit-content;\n    "], ["\n      background-color: ", ";\n      margin: ", ";\n      padding: ", ";\n      width: fit-content;\n    "])), theme.colors.background.secondary, theme.spacing(1, 0), theme.spacing(1, 4.6, 1, 1.5)),
        matchersOperator: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      min-width: 140px;\n    "], ["\n      min-width: 140px;\n    "]))),
        nestedPolicies: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      margin-top: ", ";\n    "], ["\n      margin-top: ", ";\n    "])), commonSpacing),
        removeButton: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      margin-left: ", ";\n      margin-top: ", ";\n    "], ["\n      margin-left: ", ";\n      margin-top: ", ";\n    "])), theme.spacing(1), theme.spacing(2.5)),
        buttonGroup: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      margin: ", " 0 ", ";\n\n      & > * + * {\n        margin-left: ", ";\n      }\n    "], ["\n      margin: ", " 0 ", ";\n\n      & > * + * {\n        margin-left: ", ";\n      }\n    "])), theme.spacing(6), commonSpacing, theme.spacing(1.5)),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
//# sourceMappingURL=AmRoutesExpandedForm.js.map