import { __rest } from "tslib";
import { css } from '@emotion/css';
import React, { useState } from 'react';
import { Stack } from '@grafana/experimental';
import { Button, Field, FieldArray, Form, IconButton, Input, InputControl, MultiSelect, Select, Switch, useStyles2, Badge, FieldValidationMessage, } from '@grafana/ui';
import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';
import { useMuteTimingOptions } from '../../hooks/useMuteTimingOptions';
import { SupportedPlugin } from '../../types/pluginBridges';
import { matcherFieldOptions } from '../../utils/alertmanager';
import { emptyArrayFieldMatcher, mapMultiSelectValueToStrings, mapSelectValueToString, stringToSelectableValue, stringsToSelectableValues, commonGroupByOptions, amRouteToFormAmRoute, promDurationValidator, repeatIntervalValidator, } from '../../utils/amroutes';
import { PromDurationInput } from './PromDurationInput';
import { getFormStyles } from './formStyles';
export const AmRoutesExpandedForm = ({ actionButtons, receivers, route, onSubmit, defaults, }) => {
    const styles = useStyles2(getStyles);
    const formStyles = useStyles2(getFormStyles);
    const [groupByOptions, setGroupByOptions] = useState(stringsToSelectableValues(route === null || route === void 0 ? void 0 : route.group_by));
    const muteTimingOptions = useMuteTimingOptions();
    const emptyMatcher = [{ name: '', operator: MatcherOperator.equal, value: '' }];
    const receiversWithOnCallOnTop = receivers.sort(onCallFirst);
    const formAmRoute = Object.assign(Object.assign({}, amRouteToFormAmRoute(route)), defaults);
    const defaultValues = Object.assign(Object.assign({}, formAmRoute), { 
        // if we're adding a new route, show at least one empty matcher
        object_matchers: route ? formAmRoute.object_matchers : emptyMatcher });
    return (React.createElement(Form, { defaultValues: defaultValues, onSubmit: onSubmit, maxWidth: "none" }, ({ control, register, errors, setValue, watch, getValues }) => {
        var _a, _b, _c;
        return (React.createElement(React.Fragment, null,
            React.createElement("input", Object.assign({ type: "hidden" }, register('id'))),
            React.createElement(FieldArray, { name: "object_matchers", control: control }, ({ fields, append, remove }) => (React.createElement(React.Fragment, null,
                React.createElement(Stack, { direction: "column", alignItems: "flex-start" },
                    React.createElement("div", null, "Matching labels"),
                    fields.length === 0 && (React.createElement(Badge, { color: "orange", className: styles.noMatchersWarning, icon: "exclamation-triangle", text: "If no matchers are specified, this notification policy will handle all alert instances." })),
                    fields.length > 0 && (React.createElement("div", { className: styles.matchersContainer }, fields.map((field, index) => {
                        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                        return (React.createElement(Stack, { direction: "row", key: field.id, alignItems: "center" },
                            React.createElement(Field, { label: "Label", invalid: !!((_b = (_a = errors.object_matchers) === null || _a === void 0 ? void 0 : _a[index]) === null || _b === void 0 ? void 0 : _b.name), error: (_e = (_d = (_c = errors.object_matchers) === null || _c === void 0 ? void 0 : _c[index]) === null || _d === void 0 ? void 0 : _d.name) === null || _e === void 0 ? void 0 : _e.message },
                                React.createElement(Input, Object.assign({}, register(`object_matchers.${index}.name`, { required: 'Field is required' }), { defaultValue: field.name, placeholder: "label", autoFocus: true }))),
                            React.createElement(Field, { label: 'Operator' },
                                React.createElement(InputControl, { render: (_a) => {
                                        var _b = _a.field, { onChange, ref } = _b, field = __rest(_b, ["onChange", "ref"]);
                                        return (React.createElement(Select, Object.assign({}, field, { className: styles.matchersOperator, onChange: (value) => onChange(value === null || value === void 0 ? void 0 : value.value), options: matcherFieldOptions, "aria-label": "Operator" })));
                                    }, defaultValue: field.operator, control: control, name: `object_matchers.${index}.operator`, rules: { required: { value: true, message: 'Required.' } } })),
                            React.createElement(Field, { label: "Value", invalid: !!((_g = (_f = errors.object_matchers) === null || _f === void 0 ? void 0 : _f[index]) === null || _g === void 0 ? void 0 : _g.value), error: (_k = (_j = (_h = errors.object_matchers) === null || _h === void 0 ? void 0 : _h[index]) === null || _j === void 0 ? void 0 : _j.value) === null || _k === void 0 ? void 0 : _k.message },
                                React.createElement(Input, Object.assign({}, register(`object_matchers.${index}.value`, { required: 'Field is required' }), { defaultValue: field.value, placeholder: "value" }))),
                            React.createElement(IconButton, { tooltip: "Remove matcher", name: 'trash-alt', onClick: () => remove(index) }, "Remove")));
                    }))),
                    React.createElement(Button, { className: styles.addMatcherBtn, icon: "plus", onClick: () => append(emptyArrayFieldMatcher), variant: "secondary", type: "button" }, "Add matcher"))))),
            React.createElement(Field, { label: "Contact point" },
                React.createElement(InputControl, { render: (_a) => {
                        var _b = _a.field, { onChange, ref } = _b, field = __rest(_b, ["onChange", "ref"]);
                        return (React.createElement(Select, Object.assign({ "aria-label": "Contact point" }, field, { className: formStyles.input, onChange: (value) => onChange(mapSelectValueToString(value)), options: receiversWithOnCallOnTop, isClearable: true })));
                    }, control: control, name: "receiver" })),
            React.createElement(Field, { label: "Continue matching subsequent sibling nodes" },
                React.createElement(Switch, Object.assign({ id: "continue-toggle" }, register('continue')))),
            React.createElement(Field, { label: "Override grouping" },
                React.createElement(Switch, Object.assign({ id: "override-grouping-toggle" }, register('overrideGrouping')))),
            watch().overrideGrouping && (React.createElement(Field, { label: "Group by", description: "Group alerts when you receive a notification based on labels. If empty it will be inherited from the parent policy." },
                React.createElement(InputControl, { rules: {
                        validate: (value) => {
                            if (!value || value.length === 0) {
                                return 'At least one group by option is required.';
                            }
                            return true;
                        },
                    }, render: (_a) => {
                        var _b = _a.field, { onChange, ref } = _b, field = __rest(_b, ["onChange", "ref"]), { fieldState: { error } } = _a;
                        return (React.createElement(React.Fragment, null,
                            React.createElement(MultiSelect, Object.assign({ "aria-label": "Group by" }, field, { invalid: Boolean(error), allowCustomValue: true, className: formStyles.input, onCreateOption: (opt) => {
                                    setGroupByOptions((opts) => [...opts, stringToSelectableValue(opt)]);
                                    // @ts-ignore-check: react-hook-form made me do this
                                    setValue('groupBy', [...field.value, opt]);
                                }, onChange: (value) => onChange(mapMultiSelectValueToStrings(value)), options: [...commonGroupByOptions, ...groupByOptions] })),
                            error && React.createElement(FieldValidationMessage, null, error.message)));
                    }, control: control, name: "groupBy" }))),
            React.createElement(Field, { label: "Override general timings" },
                React.createElement(Switch, Object.assign({ id: "override-timings-toggle" }, register('overrideTimings')))),
            watch().overrideTimings && (React.createElement(React.Fragment, null,
                React.createElement(Field, { label: "Group wait", description: "The waiting time until the initial notification is sent for a new group created by an incoming alert. If empty it will be inherited from the parent policy.", invalid: !!errors.groupWaitValue, error: (_a = errors.groupWaitValue) === null || _a === void 0 ? void 0 : _a.message },
                    React.createElement(PromDurationInput, Object.assign({}, register('groupWaitValue', { validate: promDurationValidator }), { "aria-label": "Group wait value", className: formStyles.promDurationInput }))),
                React.createElement(Field, { label: "Group interval", description: "The waiting time to send a batch of new alerts for that group after the first notification was sent. If empty it will be inherited from the parent policy.", invalid: !!errors.groupIntervalValue, error: (_b = errors.groupIntervalValue) === null || _b === void 0 ? void 0 : _b.message },
                    React.createElement(PromDurationInput, Object.assign({}, register('groupIntervalValue', { validate: promDurationValidator }), { "aria-label": "Group interval value", className: formStyles.promDurationInput }))),
                React.createElement(Field, { label: "Repeat interval", description: "The waiting time to resend an alert after they have successfully been sent.", invalid: !!errors.repeatIntervalValue, error: (_c = errors.repeatIntervalValue) === null || _c === void 0 ? void 0 : _c.message },
                    React.createElement(PromDurationInput, Object.assign({}, register('repeatIntervalValue', {
                        validate: (value) => {
                            const groupInterval = getValues('groupIntervalValue');
                            return repeatIntervalValidator(value, groupInterval);
                        },
                    }), { "aria-label": "Repeat interval value", className: formStyles.promDurationInput }))))),
            React.createElement(Field, { label: "Mute timings", "data-testid": "am-mute-timing-select", description: "Add mute timing to policy", invalid: !!errors.muteTimeIntervals },
                React.createElement(InputControl, { render: (_a) => {
                        var _b = _a.field, { onChange, ref } = _b, field = __rest(_b, ["onChange", "ref"]);
                        return (React.createElement(MultiSelect, Object.assign({ "aria-label": "Mute timings" }, field, { className: formStyles.input, onChange: (value) => onChange(mapMultiSelectValueToStrings(value)), options: muteTimingOptions })));
                    }, control: control, name: "muteTimeIntervals" })),
            actionButtons));
    }));
};
function onCallFirst(receiver) {
    if (receiver.grafanaAppReceiverType === SupportedPlugin.OnCall) {
        return -1;
    }
    else {
        return 0;
    }
}
const getStyles = (theme) => {
    const commonSpacing = theme.spacing(3.5);
    return {
        addMatcherBtn: css `
      margin-bottom: ${commonSpacing};
    `,
        matchersContainer: css `
      background-color: ${theme.colors.background.secondary};
      padding: ${theme.spacing(1.5)} ${theme.spacing(2)};
      padding-bottom: 0;
      width: fit-content;
    `,
        matchersOperator: css `
      min-width: 120px;
    `,
        noMatchersWarning: css `
      padding: ${theme.spacing(1)} ${theme.spacing(2)};
    `,
    };
};
//# sourceMappingURL=EditNotificationPolicyForm.js.map