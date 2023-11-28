import { __awaiter } from "tslib";
import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { withTypes } from 'react-final-form';
import { AppEvents } from '@grafana/data';
import { Button, Spinner, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { EmailAuthType } from 'app/percona/settings/Settings.types';
import { CheckboxField } from 'app/percona/shared/components/Elements/Checkbox';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { PasswordInputField } from 'app/percona/shared/components/Form/PasswordInput';
import { RadioButtonGroupField } from 'app/percona/shared/components/Form/RadioButtonGroup';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { logger } from 'app/percona/shared/helpers/logger';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { getSettingsStyles } from '../../../Settings.styles';
import { Messages } from '../Communication.messages';
import { emailOptions } from './Email.constants';
import { getStyles } from './Email.styles';
import { cleanupFormValues, getInitialValues } from './Email.utils';
import { TestEmailSettings } from './TestEmailSettings/TestEmailSettings';
export const Email = ({ updateSettings, settings, testSettings }) => {
    const testRef = useRef(null);
    const applyRef = useRef(null);
    const testEmailRef = useRef(settings.test_email);
    const settingsStyles = useStyles2(getSettingsStyles);
    const styles = useStyles2(getStyles);
    const [loading, setLoading] = useState(false);
    const applyChanges = (values) => __awaiter(void 0, void 0, void 0, function* () {
        yield updateSettings({
            email_alerting_settings: Object.assign(Object.assign({}, cleanupFormValues(values)), { test_email: testEmailRef.current }),
        }, setLoading);
    });
    const resetUsernameAndPasswordState = (form) => {
        form.resetFieldState('username');
        form.resetFieldState('password');
    };
    const handleTestClick = (values, email) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield testSettings({ email_alerting_settings: cleanupFormValues(values) }, email);
            appEvents.emit(AppEvents.alertSuccess, [Messages.emailSent]);
        }
        catch (e) {
            logger.error(e);
        }
    });
    const initialValues = getInitialValues(settings);
    const { Form } = withTypes();
    return (React.createElement(React.Fragment, null,
        React.createElement(Form, { onSubmit: applyChanges, initialValues: initialValues, render: ({ handleSubmit, valid, pristine, values, form }) => (React.createElement("form", { className: styles.emailForm, onSubmit: handleSubmit },
                React.createElement("div", { className: settingsStyles.labelWrapper },
                    React.createElement("span", null, Messages.fields.smarthost.label),
                    React.createElement(LinkTooltip, { tooltipContent: Messages.fields.smarthost.tooltipText, link: Messages.fields.smarthost.tooltipLink, linkText: Messages.fields.smarthost.tooltipLinkText, icon: "info-circle" })),
                React.createElement(TextInputField, { name: "smarthost", validators: [validators.required] }),
                React.createElement("div", { className: settingsStyles.labelWrapper },
                    React.createElement("span", null, Messages.fields.hello.label),
                    React.createElement(LinkTooltip, { tooltipContent: Messages.fields.hello.tooltipText, link: Messages.fields.hello.tooltipLink, linkText: Messages.fields.hello.tooltipLinkText, icon: "info-circle" })),
                React.createElement(TextInputField, { validators: [validators.required], name: "hello" }),
                React.createElement("div", { className: settingsStyles.labelWrapper },
                    React.createElement("span", null, Messages.fields.from.label),
                    React.createElement(LinkTooltip, { tooltipContent: Messages.fields.from.tooltipText, link: Messages.fields.from.tooltipLink, linkText: Messages.fields.from.tooltipLinkText, icon: "info-circle" })),
                React.createElement(TextInputField, { name: "from", validators: [validators.required, validators.email] }),
                React.createElement("div", { className: settingsStyles.labelWrapper },
                    React.createElement("span", null, Messages.fields.type.label),
                    React.createElement(LinkTooltip, { tooltipContent: Messages.fields.type.tooltipText, link: Messages.fields.type.tooltipLink, linkText: Messages.fields.type.tooltipLinkText, icon: "info-circle" })),
                React.createElement(RadioButtonGroupField, { inputProps: {
                        onInput: () => resetUsernameAndPasswordState(form),
                    }, className: styles.authRadioGroup, options: emailOptions, name: "authType", fullWidth: true }),
                React.createElement("div", { className: settingsStyles.labelWrapper },
                    React.createElement("span", null, Messages.fields.username.label),
                    React.createElement(LinkTooltip, { tooltipContent: Messages.fields.username.tooltipText, link: Messages.fields.username.tooltipLink, linkText: Messages.fields.username.tooltipLinkText, icon: "info-circle" })),
                React.createElement(TextInputField, { disabled: values.authType === EmailAuthType.NONE, validators: values.authType === EmailAuthType.NONE ? [] : [validators.required], name: "username" }),
                React.createElement("div", { className: settingsStyles.labelWrapper },
                    React.createElement("span", null, Messages.fields.password.label),
                    React.createElement(LinkTooltip, { tooltipContent: Messages.fields.password.tooltipText, link: Messages.fields.password.tooltipLink, linkText: Messages.fields.password.tooltipLinkText, icon: "info-circle" })),
                React.createElement(PasswordInputField, { disabled: values.authType === EmailAuthType.NONE, validators: values.authType === EmailAuthType.NONE ? [] : [validators.required], name: "password" }),
                React.createElement(CheckboxField, { name: "requireTls", label: "Require TLS" }),
                testRef.current &&
                    createPortal(React.createElement(TestEmailSettings, { onInput: (email) => (testEmailRef.current = email), onTest: (email) => handleTestClick(values, email), initialValue: settings.test_email }), testRef.current),
                applyRef.current &&
                    createPortal(React.createElement(Button, { className: settingsStyles.actionButton, type: "submit", disabled: !valid || pristine || loading, "data-testid": "email-settings-submit-button", onClick: handleSubmit },
                        loading && React.createElement(Spinner, null),
                        Messages.actionButton), applyRef.current))) }),
        React.createElement("div", { ref: (e) => (testRef.current = e) }),
        React.createElement("div", { ref: (e) => (applyRef.current = e) })));
};
//# sourceMappingURL=Email.js.map