import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useCallback } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { isFetchError } from '@grafana/runtime';
import { Alert, Button, Field, Input, LinkButton, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { getMessageFromError } from '../../../../../../core/utils/errors';
import { logAlertingError } from '../../../Analytics';
import { isOnCallFetchError } from '../../../api/onCallApi';
import { useControlledFieldArray } from '../../../hooks/useControlledFieldArray';
import { makeAMLink } from '../../../utils/misc';
import { initialAsyncRequestState } from '../../../utils/redux';
import { ChannelSubForm } from './ChannelSubForm';
import { DeletedSubForm } from './fields/DeletedSubform';
import { normalizeFormValues } from './util';
export function ReceiverForm({ config, initialValues, defaultItem, notifiers, alertManagerSourceName, onSubmit, onTestChannel, takenReceiverNames, commonSettingsComponent, isEditable, isTestable, customValidators, }) {
    const notifyApp = useAppNotification();
    const styles = useStyles2(getStyles);
    // normalize deprecated and new config values
    const normalizedConfig = normalizeFormValues(initialValues);
    const defaultValues = normalizedConfig !== null && normalizedConfig !== void 0 ? normalizedConfig : {
        name: '',
        items: [
            Object.assign(Object.assign({}, defaultItem), { __id: String(Math.random()) }),
        ],
    };
    const formAPI = useForm({
        // making a copy here beacuse react-hook-form will mutate these, and break if the object is frozen. for real.
        defaultValues: structuredClone(defaultValues),
    });
    useCleanup((state) => (state.unifiedAlerting.saveAMConfig = initialAsyncRequestState));
    const { handleSubmit, register, formState: { errors, isSubmitting }, getValues, } = formAPI;
    const { fields, append, remove } = useControlledFieldArray({ name: 'items', formAPI, softDelete: true });
    const validateNameIsAvailable = useCallback((name) => takenReceiverNames.map((name) => name.trim().toLowerCase()).includes(name.trim().toLowerCase())
        ? 'Another receiver with this name already exists.'
        : true, [takenReceiverNames]);
    const submitCallback = (values) => __awaiter(this, void 0, void 0, function* () {
        try {
            yield onSubmit(Object.assign(Object.assign({}, values), { items: values.items.filter((item) => !item.__deleted) }));
        }
        catch (e) {
            if (e instanceof Error || isFetchError(e)) {
                notifyApp.error('Failed to save the contact point', getErrorMessage(e));
                const error = new Error('Failed to save the contact point');
                error.cause = e;
                logAlertingError(error);
            }
            throw e;
        }
    });
    const onInvalid = () => {
        notifyApp.error('There are errors in the form. Please correct them and try again!');
    };
    return (React.createElement(FormProvider, Object.assign({}, formAPI),
        !config.alertmanager_config.route && (React.createElement(Alert, { severity: "warning", title: "Attention" }, "Because there is no default policy configured yet, this contact point will automatically be set as default.")),
        React.createElement("form", { onSubmit: handleSubmit(submitCallback, onInvalid) },
            React.createElement("h4", { className: styles.heading }, !isEditable ? 'Contact point' : initialValues ? 'Update contact point' : 'Create contact point'),
            React.createElement(Field, { label: "Name", invalid: !!errors.name, error: errors.name && errors.name.message, required: true },
                React.createElement(Input, Object.assign({ readOnly: !isEditable, id: "name" }, register('name', {
                    required: 'Name is required',
                    validate: { nameIsAvailable: validateNameIsAvailable },
                }), { width: 39, placeholder: "Name" }))),
            fields.map((field, index) => {
                var _a;
                const pathPrefix = `items.${index}.`;
                if (field.__deleted) {
                    return React.createElement(DeletedSubForm, { key: field.__id, pathPrefix: pathPrefix });
                }
                const initialItem = initialValues === null || initialValues === void 0 ? void 0 : initialValues.items.find(({ __id }) => __id === field.__id);
                return (React.createElement(ChannelSubForm, { defaultValues: field, initialValues: initialItem, key: field.__id, onDuplicate: () => {
                        const currentValues = getValues().items[index];
                        append(Object.assign(Object.assign({}, currentValues), { __id: String(Math.random()) }));
                    }, onTest: onTestChannel
                        ? () => {
                            const currentValues = getValues().items[index];
                            onTestChannel(currentValues);
                        }
                        : undefined, onDelete: () => remove(index), pathPrefix: pathPrefix, notifiers: notifiers, secureFields: initialItem === null || initialItem === void 0 ? void 0 : initialItem.secureFields, errors: (_a = errors === null || errors === void 0 ? void 0 : errors.items) === null || _a === void 0 ? void 0 : _a[index], commonSettingsComponent: commonSettingsComponent, isEditable: isEditable, isTestable: isTestable, customValidators: customValidators ? customValidators[field.type] : undefined }));
            }),
            React.createElement(React.Fragment, null,
                isEditable && (React.createElement(Button, { type: "button", icon: "plus", variant: "secondary", onClick: () => append(Object.assign(Object.assign({}, defaultItem), { __id: String(Math.random()) })) }, "Add contact point integration")),
                React.createElement("div", { className: styles.buttons },
                    isEditable && (React.createElement(React.Fragment, null,
                        isSubmitting && (React.createElement(Button, { disabled: true, icon: "fa fa-spinner", variant: "primary" }, "Saving...")),
                        !isSubmitting && React.createElement(Button, { type: "submit" }, "Save contact point"))),
                    React.createElement(LinkButton, { disabled: isSubmitting, variant: "secondary", "data-testid": "cancel-button", href: makeAMLink('alerting/notifications', alertManagerSourceName) }, "Cancel"))))));
}
const getStyles = (theme) => ({
    heading: css `
    margin: ${theme.spacing(4, 0)};
  `,
    buttons: css `
    margin-top: ${theme.spacing(4)};

    & > * + * {
      margin-left: ${theme.spacing(1)};
    }
  `,
});
function getErrorMessage(error) {
    if (isOnCallFetchError(error)) {
        return error.data.detail;
    }
    return getMessageFromError(error);
}
//# sourceMappingURL=ReceiverForm.js.map