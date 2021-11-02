import { __assign, __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { AppEvents } from '@grafana/data';
import { Alert, Button, Field, Input, LinkButton, useStyles2 } from '@grafana/ui';
import { useCleanup } from 'app/core/hooks/useCleanup';
import React, { useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useControlledFieldArray } from '../../../hooks/useControlledFieldArray';
import { useUnifiedAlertingSelector } from '../../../hooks/useUnifiedAlertingSelector';
import { makeAMLink } from '../../../utils/misc';
import { ChannelSubForm } from './ChannelSubForm';
import { DeletedSubForm } from './fields/DeletedSubform';
import { appEvents } from 'app/core/core';
import { isVanillaPrometheusAlertManagerDataSource } from '../../../utils/datasource';
export function ReceiverForm(_a) {
    var config = _a.config, initialValues = _a.initialValues, defaultItem = _a.defaultItem, notifiers = _a.notifiers, alertManagerSourceName = _a.alertManagerSourceName, onSubmit = _a.onSubmit, onTestChannel = _a.onTestChannel, takenReceiverNames = _a.takenReceiverNames, commonSettingsComponent = _a.commonSettingsComponent;
    var styles = useStyles2(getStyles);
    var readOnly = isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName);
    var defaultValues = initialValues || {
        name: '',
        items: [
            __assign(__assign({}, defaultItem), { __id: String(Math.random()) }),
        ],
    };
    var formAPI = useForm({
        // making a copy here beacuse react-hook-form will mutate these, and break if the object is frozen. for real.
        defaultValues: JSON.parse(JSON.stringify(defaultValues)),
    });
    useCleanup(function (state) { return state.unifiedAlerting.saveAMConfig; });
    var loading = useUnifiedAlertingSelector(function (state) { return state.saveAMConfig; }).loading;
    var handleSubmit = formAPI.handleSubmit, register = formAPI.register, errors = formAPI.formState.errors, getValues = formAPI.getValues;
    var _b = useControlledFieldArray({ name: 'items', formAPI: formAPI, softDelete: true }), fields = _b.fields, append = _b.append, remove = _b.remove;
    var validateNameIsAvailable = useCallback(function (name) {
        return takenReceiverNames.map(function (name) { return name.trim().toLowerCase(); }).includes(name.trim().toLowerCase())
            ? 'Another receiver with this name already exists.'
            : true;
    }, [takenReceiverNames]);
    var submitCallback = function (values) {
        onSubmit(__assign(__assign({}, values), { items: values.items.filter(function (item) { return !item.__deleted; }) }));
    };
    var onInvalid = function () {
        appEvents.emit(AppEvents.alertError, ['There are errors in the form. Please correct them and try again!']);
    };
    return (React.createElement(FormProvider, __assign({}, formAPI),
        !config.alertmanager_config.route && (React.createElement(Alert, { severity: "warning", title: "Attention" }, "Because there is no default policy configured yet, this contact point will automatically be set as default.")),
        React.createElement("form", { onSubmit: handleSubmit(submitCallback, onInvalid) },
            React.createElement("h4", { className: styles.heading }, readOnly ? 'Contact point' : initialValues ? 'Update contact point' : 'Create contact point'),
            React.createElement(Field, { label: "Name", invalid: !!errors.name, error: errors.name && errors.name.message, required: true },
                React.createElement(Input, __assign({ readOnly: readOnly, id: "name" }, register('name', {
                    required: 'Name is required',
                    validate: { nameIsAvailable: validateNameIsAvailable },
                }), { width: 39, placeholder: "Name" }))),
            fields.map(function (field, index) {
                var _a;
                var pathPrefix = "items." + index + ".";
                if (field.__deleted) {
                    return React.createElement(DeletedSubForm, { key: field.__id, pathPrefix: pathPrefix });
                }
                var initialItem = initialValues === null || initialValues === void 0 ? void 0 : initialValues.items.find(function (_a) {
                    var __id = _a.__id;
                    return __id === field.__id;
                });
                return (React.createElement(ChannelSubForm, { defaultValues: field, key: field.__id, onDuplicate: function () {
                        var currentValues = getValues().items[index];
                        append(__assign(__assign({}, currentValues), { __id: String(Math.random()) }));
                    }, onTest: onTestChannel
                        ? function () {
                            var currentValues = getValues().items[index];
                            onTestChannel(currentValues);
                        }
                        : undefined, onDelete: function () { return remove(index); }, pathPrefix: pathPrefix, notifiers: notifiers, secureFields: initialItem === null || initialItem === void 0 ? void 0 : initialItem.secureFields, errors: (_a = errors === null || errors === void 0 ? void 0 : errors.items) === null || _a === void 0 ? void 0 : _a[index], commonSettingsComponent: commonSettingsComponent, readOnly: readOnly }));
            }),
            React.createElement(React.Fragment, null,
                !readOnly && (React.createElement(Button, { type: "button", icon: "plus", variant: "secondary", onClick: function () { return append(__assign(__assign({}, defaultItem), { __id: String(Math.random()) })); } }, "New contact point type")),
                React.createElement("div", { className: styles.buttons },
                    !readOnly && (React.createElement(React.Fragment, null,
                        loading && (React.createElement(Button, { disabled: true, icon: "fa fa-spinner", variant: "primary" }, "Saving...")),
                        !loading && React.createElement(Button, { type: "submit" }, "Save contact point"))),
                    React.createElement(LinkButton, { disabled: loading, fill: "outline", variant: "secondary", "data-testid": "cancel-button", href: makeAMLink('alerting/notifications', alertManagerSourceName) }, "Cancel"))))));
}
var getStyles = function (theme) { return ({
    heading: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin: ", ";\n  "], ["\n    margin: ", ";\n  "])), theme.spacing(4, 0)),
    buttons: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    margin-top: ", ";\n\n    & > * + * {\n      margin-left: ", ";\n    }\n  "], ["\n    margin-top: ", ";\n\n    & > * + * {\n      margin-left: ", ";\n    }\n  "])), theme.spacing(4), theme.spacing(1)),
}); };
var templateObject_1, templateObject_2;
//# sourceMappingURL=ReceiverForm.js.map