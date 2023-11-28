import { __awaiter, __rest } from "tslib";
import { css } from '@emotion/css';
import { sortBy } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Alert, Button, Field, InputControl, Select, useStyles2 } from '@grafana/ui';
import { useUnifiedAlertingSelector } from '../../../hooks/useUnifiedAlertingSelector';
import { OnCallIntegrationType } from '../grafanaAppReceivers/onCall/useOnCallIntegration';
import { ChannelOptions } from './ChannelOptions';
import { CollapsibleSection } from './CollapsibleSection';
export function ChannelSubForm({ defaultValues, initialValues, pathPrefix, onDuplicate, onDelete, onTest, notifiers, errors, secureFields, commonSettingsComponent: CommonSettingsComponent, isEditable = true, isTestable, customValidators = {}, }) {
    var _a;
    const styles = useStyles2(getStyles);
    const fieldName = useCallback((fieldName) => `${pathPrefix}${fieldName}`, [pathPrefix]);
    const { control, watch, register, trigger, formState, setValue } = useFormContext();
    const selectedType = (_a = watch(fieldName('type'))) !== null && _a !== void 0 ? _a : defaultValues.type; // nope, setting "default" does not work at all.
    const { loading: testingReceiver } = useUnifiedAlertingSelector((state) => state.testReceivers);
    // TODO I don't like integration specific code here but other ways require a bigger refactoring
    const onCallIntegrationType = watch(fieldName('settings.integration_type'));
    const isTestAvailable = onCallIntegrationType !== OnCallIntegrationType.NewIntegration;
    useEffect(() => {
        register(`${pathPrefix}.__id`);
        /* Need to manually register secureFields or else they'll
         be lost when testing a contact point */
        register(`${pathPrefix}.secureFields`);
    }, [register, pathPrefix]);
    // Prevent forgetting about initial values when switching the integration type and the oncall integration type
    useEffect(() => {
        // Restore values when switching back from a changed integration to the default one
        const subscription = watch((_, { name, type, value }) => {
            if (initialValues && name === fieldName('type') && value === initialValues.type && type === 'change') {
                setValue(fieldName('settings'), initialValues.settings);
            }
            // Restore initial value of an existing oncall integration
            if (initialValues &&
                name === fieldName('settings.integration_type') &&
                value === OnCallIntegrationType.ExistingIntegration) {
                setValue(fieldName('settings.url'), initialValues.settings['url']);
            }
        });
        return () => subscription.unsubscribe();
    }, [selectedType, initialValues, setValue, fieldName, watch]);
    const [_secureFields, setSecureFields] = useState(secureFields !== null && secureFields !== void 0 ? secureFields : {});
    const onResetSecureField = (key) => {
        if (_secureFields[key]) {
            const updatedSecureFields = Object.assign({}, secureFields);
            delete updatedSecureFields[key];
            setSecureFields(updatedSecureFields);
            setValue(`${pathPrefix}.secureFields`, updatedSecureFields);
        }
    };
    const typeOptions = useMemo(() => sortBy(notifiers, ({ dto, meta }) => { var _a; return [(_a = meta === null || meta === void 0 ? void 0 : meta.order) !== null && _a !== void 0 ? _a : 0, dto.name]; })
        // .notifiers.sort((a, b) => a.dto.name.localeCompare(b.dto.name))
        .map(({ dto: { name, type }, meta }) => ({
        label: name,
        value: type,
        description: meta === null || meta === void 0 ? void 0 : meta.description,
        isDisabled: meta ? !meta.enabled : false,
        imgUrl: meta === null || meta === void 0 ? void 0 : meta.iconUrl,
    })), [notifiers]);
    const handleTest = () => __awaiter(this, void 0, void 0, function* () {
        yield trigger();
        const isValid = Object.keys(formState.errors).length === 0;
        if (isValid && onTest) {
            onTest();
        }
    });
    const notifier = notifiers.find(({ dto: { type } }) => type === selectedType);
    // if there are mandatory options defined, optional options will be hidden by a collapse
    // if there aren't mandatory options, all options will be shown without collapse
    const mandatoryOptions = notifier === null || notifier === void 0 ? void 0 : notifier.dto.options.filter((o) => o.required);
    const optionalOptions = notifier === null || notifier === void 0 ? void 0 : notifier.dto.options.filter((o) => !o.required);
    const contactPointTypeInputId = `contact-point-type-${pathPrefix}`;
    return (React.createElement("div", { className: styles.wrapper, "data-testid": "item-container" },
        React.createElement("div", { className: styles.topRow },
            React.createElement("div", null,
                React.createElement(Field, { label: "Integration", htmlFor: contactPointTypeInputId, "data-testid": `${pathPrefix}type` },
                    React.createElement(InputControl, { name: fieldName('type'), defaultValue: defaultValues.type, render: (_a) => {
                            var _b = _a.field, { ref, onChange } = _b, field = __rest(_b, ["ref", "onChange"]);
                            return (React.createElement(Select, Object.assign({ disabled: !isEditable, inputId: contactPointTypeInputId }, field, { width: 37, options: typeOptions, onChange: (value) => onChange(value === null || value === void 0 ? void 0 : value.value) })));
                        }, control: control, rules: { required: true } }))),
            React.createElement("div", { className: styles.buttons },
                isTestable && onTest && isTestAvailable && (React.createElement(Button, { disabled: testingReceiver, size: "xs", variant: "secondary", type: "button", onClick: () => handleTest(), icon: testingReceiver ? 'fa fa-spinner' : 'message' }, "Test")),
                isEditable && (React.createElement(React.Fragment, null,
                    React.createElement(Button, { size: "xs", variant: "secondary", type: "button", onClick: () => onDuplicate(), icon: "copy" }, "Duplicate"),
                    onDelete && (React.createElement(Button, { "data-testid": `${pathPrefix}delete-button`, size: "xs", variant: "secondary", type: "button", onClick: () => onDelete(), icon: "trash-alt" }, "Delete")))))),
        notifier && (React.createElement("div", { className: styles.innerContent },
            React.createElement(ChannelOptions, { defaultValues: defaultValues, selectedChannelOptions: (mandatoryOptions === null || mandatoryOptions === void 0 ? void 0 : mandatoryOptions.length) ? mandatoryOptions : optionalOptions, secureFields: _secureFields, errors: errors, onResetSecureField: onResetSecureField, pathPrefix: pathPrefix, readOnly: !isEditable, customValidators: customValidators }),
            !!((mandatoryOptions === null || mandatoryOptions === void 0 ? void 0 : mandatoryOptions.length) && (optionalOptions === null || optionalOptions === void 0 ? void 0 : optionalOptions.length)) && (React.createElement(CollapsibleSection, { label: `Optional ${notifier.dto.name} settings` },
                notifier.dto.info !== '' && (React.createElement(Alert, { title: "", severity: "info" }, notifier.dto.info)),
                React.createElement(ChannelOptions, { defaultValues: defaultValues, selectedChannelOptions: optionalOptions, secureFields: _secureFields, onResetSecureField: onResetSecureField, errors: errors, pathPrefix: pathPrefix, readOnly: !isEditable, customValidators: customValidators }))),
            React.createElement(CollapsibleSection, { label: "Notification settings" },
                React.createElement(CommonSettingsComponent, { pathPrefix: pathPrefix, readOnly: !isEditable }))))));
}
const getStyles = (theme) => ({
    buttons: css `
    & > * + * {
      margin-left: ${theme.spacing(1)};
    }
  `,
    innerContent: css `
    max-width: 536px;
  `,
    wrapper: css `
    margin: ${theme.spacing(2, 0)};
    padding: ${theme.spacing(1)};
    border: solid 1px ${theme.colors.border.medium};
    border-radius: ${theme.shape.radius.default};
    max-width: ${theme.breakpoints.values.xl}${theme.breakpoints.unit};
  `,
    topRow: css `
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  `,
    channelSettingsHeader: css `
    margin-top: ${theme.spacing(2)};
  `,
});
//# sourceMappingURL=ChannelSubForm.js.map