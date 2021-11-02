import { __assign, __makeTemplateObject, __read, __rest } from "tslib";
import React, { useEffect, useMemo, useState } from 'react';
import { css } from '@emotion/css';
import { Alert, Button, Field, InputControl, Select, useStyles2 } from '@grafana/ui';
import { useFormContext } from 'react-hook-form';
import { ChannelOptions } from './ChannelOptions';
import { CollapsibleSection } from './CollapsibleSection';
import { useUnifiedAlertingSelector } from '../../../hooks/useUnifiedAlertingSelector';
export function ChannelSubForm(_a) {
    var _b;
    var defaultValues = _a.defaultValues, pathPrefix = _a.pathPrefix, onDuplicate = _a.onDuplicate, onDelete = _a.onDelete, onTest = _a.onTest, notifiers = _a.notifiers, errors = _a.errors, secureFields = _a.secureFields, CommonSettingsComponent = _a.commonSettingsComponent, _c = _a.readOnly, readOnly = _c === void 0 ? false : _c;
    var styles = useStyles2(getStyles);
    var name = function (fieldName) { return "" + pathPrefix + fieldName; };
    var _d = useFormContext(), control = _d.control, watch = _d.watch, register = _d.register;
    var selectedType = (_b = watch(name('type'))) !== null && _b !== void 0 ? _b : defaultValues.type; // nope, setting "default" does not work at all.
    var testingReceiver = useUnifiedAlertingSelector(function (state) { return state.testReceivers; }).loading;
    useEffect(function () {
        register(pathPrefix + ".__id");
    }, [register, pathPrefix]);
    var _e = __read(useState(secureFields !== null && secureFields !== void 0 ? secureFields : {}), 2), _secureFields = _e[0], setSecureFields = _e[1];
    var onResetSecureField = function (key) {
        if (_secureFields[key]) {
            var updatedSecureFields = __assign({}, secureFields);
            delete updatedSecureFields[key];
            setSecureFields(updatedSecureFields);
        }
    };
    var typeOptions = useMemo(function () {
        return notifiers
            .map(function (_a) {
            var name = _a.name, type = _a.type;
            return ({
                label: name,
                value: type,
            });
        })
            .sort(function (a, b) { return a.label.localeCompare(b.label); });
    }, [notifiers]);
    var notifier = notifiers.find(function (_a) {
        var type = _a.type;
        return type === selectedType;
    });
    // if there are mandatory options defined, optional options will be hidden by a collapse
    // if there aren't mandatory options, all options will be shown without collapse
    var mandatoryOptions = notifier === null || notifier === void 0 ? void 0 : notifier.options.filter(function (o) { return o.required; });
    var optionalOptions = notifier === null || notifier === void 0 ? void 0 : notifier.options.filter(function (o) { return !o.required; });
    return (React.createElement("div", { className: styles.wrapper, "data-testid": "item-container" },
        React.createElement("div", { className: styles.topRow },
            React.createElement("div", null,
                React.createElement(Field, { label: "Contact point type", "data-testid": pathPrefix + "type" },
                    React.createElement(InputControl, { name: name('type'), defaultValue: defaultValues.type, render: function (_a) {
                            var _b = _a.field, ref = _b.ref, onChange = _b.onChange, field = __rest(_b, ["ref", "onChange"]);
                            return (React.createElement(Select, __assign({ disabled: readOnly, menuShouldPortal: true }, field, { width: 37, options: typeOptions, onChange: function (value) { return onChange(value === null || value === void 0 ? void 0 : value.value); } })));
                        }, control: control, rules: { required: true } }))),
            !readOnly && (React.createElement("div", { className: styles.buttons },
                onTest && (React.createElement(Button, { disabled: testingReceiver, size: "xs", variant: "secondary", type: "button", onClick: function () { return onTest(); }, icon: testingReceiver ? 'fa fa-spinner' : 'message' }, "Test")),
                React.createElement(Button, { size: "xs", variant: "secondary", type: "button", onClick: function () { return onDuplicate(); }, icon: "copy" }, "Duplicate"),
                onDelete && (React.createElement(Button, { "data-testid": pathPrefix + "delete-button", size: "xs", variant: "secondary", type: "button", onClick: function () { return onDelete(); }, icon: "trash-alt" }, "Delete"))))),
        notifier && (React.createElement("div", { className: styles.innerContent },
            React.createElement(ChannelOptions, { defaultValues: defaultValues, selectedChannelOptions: (mandatoryOptions === null || mandatoryOptions === void 0 ? void 0 : mandatoryOptions.length) ? mandatoryOptions : optionalOptions, secureFields: _secureFields, errors: errors, onResetSecureField: onResetSecureField, pathPrefix: pathPrefix, readOnly: readOnly }),
            !!((mandatoryOptions === null || mandatoryOptions === void 0 ? void 0 : mandatoryOptions.length) && (optionalOptions === null || optionalOptions === void 0 ? void 0 : optionalOptions.length)) && (React.createElement(CollapsibleSection, { label: "Optional " + notifier.name + " settings" },
                notifier.info !== '' && (React.createElement(Alert, { title: "", severity: "info" }, notifier.info)),
                React.createElement(ChannelOptions, { defaultValues: defaultValues, selectedChannelOptions: optionalOptions, secureFields: _secureFields, onResetSecureField: onResetSecureField, errors: errors, pathPrefix: pathPrefix, readOnly: readOnly }))),
            React.createElement(CollapsibleSection, { label: "Notification settings" },
                React.createElement(CommonSettingsComponent, { pathPrefix: pathPrefix, readOnly: readOnly }))))));
}
var getStyles = function (theme) { return ({
    buttons: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    & > * + * {\n      margin-left: ", ";\n    }\n  "], ["\n    & > * + * {\n      margin-left: ", ";\n    }\n  "])), theme.spacing(1)),
    innerContent: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    max-width: 536px;\n  "], ["\n    max-width: 536px;\n  "]))),
    wrapper: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin: ", ";\n    padding: ", ";\n    border: solid 1px ", ";\n    border-radius: ", ";\n    max-width: ", "", ";\n  "], ["\n    margin: ", ";\n    padding: ", ";\n    border: solid 1px ", ";\n    border-radius: ", ";\n    max-width: ", "", ";\n  "])), theme.spacing(2, 0), theme.spacing(1), theme.colors.border.medium, theme.shape.borderRadius(1), theme.breakpoints.values.xl, theme.breakpoints.unit),
    topRow: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: row;\n    justify-content: space-between;\n  "], ["\n    display: flex;\n    flex-direction: row;\n    justify-content: space-between;\n  "]))),
    channelSettingsHeader: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    margin-top: ", ";\n  "], ["\n    margin-top: ", ";\n  "])), theme.spacing(2)),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=ChannelSubForm.js.map