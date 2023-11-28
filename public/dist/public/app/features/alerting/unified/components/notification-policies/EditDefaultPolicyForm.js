import { __rest } from "tslib";
import React, { useState } from 'react';
import { Collapse, Field, Form, InputControl, Link, MultiSelect, Select, useStyles2 } from '@grafana/ui';
import { amRouteToFormAmRoute, commonGroupByOptions, mapMultiSelectValueToStrings, mapSelectValueToString, promDurationValidator, repeatIntervalValidator, stringsToSelectableValues, stringToSelectableValue, } from '../../utils/amroutes';
import { makeAMLink } from '../../utils/misc';
import { PromDurationInput } from './PromDurationInput';
import { getFormStyles } from './formStyles';
import { TIMING_OPTIONS_DEFAULTS } from './timingOptions';
export const AmRootRouteForm = ({ actionButtons, alertManagerSourceName, onSubmit, receivers, route, }) => {
    const styles = useStyles2(getFormStyles);
    const [isTimingOptionsExpanded, setIsTimingOptionsExpanded] = useState(false);
    const [groupByOptions, setGroupByOptions] = useState(stringsToSelectableValues(route.group_by));
    const defaultValues = amRouteToFormAmRoute(route);
    return (React.createElement(Form, { defaultValues: Object.assign(Object.assign({}, defaultValues), { overrideTimings: true, overrideGrouping: true }), onSubmit: onSubmit }, ({ register, control, errors, setValue, getValues }) => {
        var _a, _b, _c, _d;
        return (React.createElement(React.Fragment, null,
            React.createElement(Field, { label: "Default contact point", invalid: !!errors.receiver, error: (_a = errors.receiver) === null || _a === void 0 ? void 0 : _a.message },
                React.createElement(React.Fragment, null,
                    React.createElement("div", { className: styles.container, "data-testid": "am-receiver-select" },
                        React.createElement(InputControl, { render: (_a) => {
                                var _b = _a.field, { onChange, ref } = _b, field = __rest(_b, ["onChange", "ref"]);
                                return (React.createElement(Select, Object.assign({ "aria-label": "Default contact point" }, field, { className: styles.input, onChange: (value) => onChange(mapSelectValueToString(value)), options: receivers })));
                            }, control: control, name: "receiver", rules: { required: { value: true, message: 'Required.' } } }),
                        React.createElement("span", null, "or"),
                        React.createElement(Link, { className: styles.linkText, href: makeAMLink('/alerting/notifications/receivers/new', alertManagerSourceName) }, "Create a contact point")))),
            React.createElement(Field, { label: "Group by", description: "Group alerts when you receive a notification based on labels.", "data-testid": "am-group-select" },
                React.createElement(InputControl, { render: (_a) => {
                        var _b = _a.field, { onChange, ref } = _b, field = __rest(_b, ["onChange", "ref"]);
                        return (React.createElement(MultiSelect, Object.assign({ "aria-label": "Group by" }, field, { allowCustomValue: true, className: styles.input, onCreateOption: (opt) => {
                                setGroupByOptions((opts) => [...opts, stringToSelectableValue(opt)]);
                                // @ts-ignore-check: react-hook-form made me do this
                                setValue('groupBy', [...field.value, opt]);
                            }, onChange: (value) => onChange(mapMultiSelectValueToStrings(value)), options: [...commonGroupByOptions, ...groupByOptions] })));
                    }, control: control, name: "groupBy" })),
            React.createElement(Collapse, { collapsible: true, className: styles.collapse, isOpen: isTimingOptionsExpanded, label: "Timing options", onToggle: setIsTimingOptionsExpanded },
                React.createElement("div", { className: styles.timingFormContainer },
                    React.createElement(Field, { label: "Group wait", description: "The waiting time until the initial notification is sent for a new group created by an incoming alert. Default 30 seconds.", invalid: !!errors.groupWaitValue, error: (_b = errors.groupWaitValue) === null || _b === void 0 ? void 0 : _b.message, "data-testid": "am-group-wait" },
                        React.createElement(PromDurationInput, Object.assign({}, register('groupWaitValue', { validate: promDurationValidator }), { placeholder: TIMING_OPTIONS_DEFAULTS.group_wait, className: styles.promDurationInput, "aria-label": "Group wait" }))),
                    React.createElement(Field, { label: "Group interval", description: "The waiting time to send a batch of new alerts for that group after the first notification was sent. Default 5 minutes.", invalid: !!errors.groupIntervalValue, error: (_c = errors.groupIntervalValue) === null || _c === void 0 ? void 0 : _c.message, "data-testid": "am-group-interval" },
                        React.createElement(PromDurationInput, Object.assign({}, register('groupIntervalValue', { validate: promDurationValidator }), { placeholder: TIMING_OPTIONS_DEFAULTS.group_interval, className: styles.promDurationInput, "aria-label": "Group interval" }))),
                    React.createElement(Field, { label: "Repeat interval", description: "The waiting time to resend an alert after they have successfully been sent. Default 4 hours. Should be a multiple of Group interval.", invalid: !!errors.repeatIntervalValue, error: (_d = errors.repeatIntervalValue) === null || _d === void 0 ? void 0 : _d.message, "data-testid": "am-repeat-interval" },
                        React.createElement(PromDurationInput, Object.assign({}, register('repeatIntervalValue', {
                            validate: (value) => {
                                const groupInterval = getValues('groupIntervalValue');
                                return repeatIntervalValidator(value, groupInterval);
                            },
                        }), { placeholder: TIMING_OPTIONS_DEFAULTS.repeat_interval, className: styles.promDurationInput, "aria-label": "Repeat interval" }))))),
            React.createElement("div", { className: styles.container }, actionButtons)));
    }));
};
//# sourceMappingURL=EditDefaultPolicyForm.js.map