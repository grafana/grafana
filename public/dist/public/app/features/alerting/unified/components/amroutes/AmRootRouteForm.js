import { __assign, __read, __rest, __spreadArray } from "tslib";
import React, { useState } from 'react';
import { cx } from '@emotion/css';
import { Button, Collapse, Field, Form, Input, InputControl, Link, MultiSelect, Select, useStyles2 } from '@grafana/ui';
import { mapMultiSelectValueToStrings, mapSelectValueToString, optionalPositiveInteger, stringToSelectableValue, stringsToSelectableValues, } from '../../utils/amroutes';
import { makeAMLink } from '../../utils/misc';
import { timeOptions } from '../../utils/time';
import { getFormStyles } from './formStyles';
export var AmRootRouteForm = function (_a) {
    var alertManagerSourceName = _a.alertManagerSourceName, onCancel = _a.onCancel, onSave = _a.onSave, receivers = _a.receivers, routes = _a.routes;
    var styles = useStyles2(getFormStyles);
    var _b = __read(useState(false), 2), isTimingOptionsExpanded = _b[0], setIsTimingOptionsExpanded = _b[1];
    var _c = __read(useState(stringsToSelectableValues(routes.groupBy)), 2), groupByOptions = _c[0], setGroupByOptions = _c[1];
    return (React.createElement(Form, { defaultValues: routes, onSubmit: onSave }, function (_a) {
        var _b, _c, _d, _e;
        var control = _a.control, errors = _a.errors, setValue = _a.setValue;
        return (React.createElement(React.Fragment, null,
            React.createElement(Field, { label: "Default contact point", invalid: !!errors.receiver, error: (_b = errors.receiver) === null || _b === void 0 ? void 0 : _b.message },
                React.createElement(React.Fragment, null,
                    React.createElement("div", { className: styles.container, "data-testid": "am-receiver-select" },
                        React.createElement(InputControl, { render: function (_a) {
                                var _b = _a.field, onChange = _b.onChange, ref = _b.ref, field = __rest(_b, ["onChange", "ref"]);
                                return (React.createElement(Select, __assign({ menuShouldPortal: true }, field, { className: styles.input, onChange: function (value) { return onChange(mapSelectValueToString(value)); }, options: receivers })));
                            }, control: control, name: "receiver", rules: { required: { value: true, message: 'Required.' } } }),
                        React.createElement("span", null, "or"),
                        React.createElement(Link, { className: styles.linkText, href: makeAMLink('/alerting/notifications/receivers/new', alertManagerSourceName) }, "Create a contact point")))),
            React.createElement(Field, { label: "Group by", description: "Group alerts when you receive a notification based on labels.", "data-testid": "am-group-select" },
                React.createElement(InputControl, { render: function (_a) {
                        var _b = _a.field, onChange = _b.onChange, ref = _b.ref, field = __rest(_b, ["onChange", "ref"]);
                        return (React.createElement(MultiSelect, __assign({ menuShouldPortal: true }, field, { allowCustomValue: true, className: styles.input, onCreateOption: function (opt) {
                                setGroupByOptions(function (opts) { return __spreadArray(__spreadArray([], __read(opts), false), [stringToSelectableValue(opt)], false); });
                                // @ts-ignore-check: react-hook-form made me do this
                                setValue('groupBy', __spreadArray(__spreadArray([], __read(field.value), false), [opt], false));
                            }, onChange: function (value) { return onChange(mapMultiSelectValueToStrings(value)); }, options: groupByOptions })));
                    }, control: control, name: "groupBy" })),
            React.createElement(Collapse, { collapsible: true, className: styles.collapse, isOpen: isTimingOptionsExpanded, label: "Timing options", onToggle: setIsTimingOptionsExpanded },
                React.createElement(Field, { label: "Group wait", description: "The waiting time until the initial notification is sent for a new group created by an incoming alert. Default 30 seconds.", invalid: !!errors.groupWaitValue, error: (_c = errors.groupWaitValue) === null || _c === void 0 ? void 0 : _c.message, "data-testid": "am-group-wait" },
                    React.createElement(React.Fragment, null,
                        React.createElement("div", { className: cx(styles.container, styles.timingContainer) },
                            React.createElement(InputControl, { render: function (_a) {
                                    var field = _a.field, invalid = _a.fieldState.invalid;
                                    return (React.createElement(Input, __assign({}, field, { className: styles.smallInput, invalid: invalid, placeholder: 'Default 30 seconds' })));
                                }, control: control, name: "groupWaitValue", rules: {
                                    validate: optionalPositiveInteger,
                                } }),
                            React.createElement(InputControl, { render: function (_a) {
                                    var _b = _a.field, onChange = _b.onChange, ref = _b.ref, field = __rest(_b, ["onChange", "ref"]);
                                    return (React.createElement(Select, __assign({ menuShouldPortal: true }, field, { className: styles.input, onChange: function (value) { return onChange(mapSelectValueToString(value)); }, options: timeOptions })));
                                }, control: control, name: "groupWaitValueType" })))),
                React.createElement(Field, { label: "Group interval", description: "The waiting time to send a batch of new alerts for that group after the first notification was sent. Default 5 minutes.", invalid: !!errors.groupIntervalValue, error: (_d = errors.groupIntervalValue) === null || _d === void 0 ? void 0 : _d.message, "data-testid": "am-group-interval" },
                    React.createElement(React.Fragment, null,
                        React.createElement("div", { className: cx(styles.container, styles.timingContainer) },
                            React.createElement(InputControl, { render: function (_a) {
                                    var field = _a.field, invalid = _a.fieldState.invalid;
                                    return (React.createElement(Input, __assign({}, field, { className: styles.smallInput, invalid: invalid, placeholder: 'Default 5 minutes' })));
                                }, control: control, name: "groupIntervalValue", rules: {
                                    validate: optionalPositiveInteger,
                                } }),
                            React.createElement(InputControl, { render: function (_a) {
                                    var _b = _a.field, onChange = _b.onChange, ref = _b.ref, field = __rest(_b, ["onChange", "ref"]);
                                    return (React.createElement(Select, __assign({ menuShouldPortal: true }, field, { className: styles.input, onChange: function (value) { return onChange(mapSelectValueToString(value)); }, options: timeOptions })));
                                }, control: control, name: "groupIntervalValueType" })))),
                React.createElement(Field, { label: "Repeat interval", description: "The waiting time to resend an alert after they have successfully been sent. Default 4 hours.", invalid: !!errors.repeatIntervalValue, error: (_e = errors.repeatIntervalValue) === null || _e === void 0 ? void 0 : _e.message, "data-testid": "am-repeat-interval" },
                    React.createElement(React.Fragment, null,
                        React.createElement("div", { className: cx(styles.container, styles.timingContainer) },
                            React.createElement(InputControl, { render: function (_a) {
                                    var field = _a.field, invalid = _a.fieldState.invalid;
                                    return (React.createElement(Input, __assign({}, field, { className: styles.smallInput, invalid: invalid, placeholder: "Default 4 hours" })));
                                }, control: control, name: "repeatIntervalValue", rules: {
                                    validate: optionalPositiveInteger,
                                } }),
                            React.createElement(InputControl, { render: function (_a) {
                                    var _b = _a.field, onChange = _b.onChange, ref = _b.ref, field = __rest(_b, ["onChange", "ref"]);
                                    return (React.createElement(Select, __assign({ menuShouldPortal: true }, field, { className: styles.input, menuPlacement: "top", onChange: function (value) { return onChange(mapSelectValueToString(value)); }, options: timeOptions })));
                                }, control: control, name: "repeatIntervalValueType" }))))),
            React.createElement("div", { className: styles.container },
                React.createElement(Button, { type: "submit" }, "Save"),
                React.createElement(Button, { onClick: onCancel, type: "reset", variant: "secondary", fill: "outline" }, "Cancel"))));
    }));
};
//# sourceMappingURL=AmRootRouteForm.js.map