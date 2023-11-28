import React, { useCallback } from 'react';
import { Form as FormFinal } from 'react-final-form';
import { Button, useStyles } from '@grafana/ui';
import { PasswordInputField } from 'app/percona/shared/components/Form/PasswordInput';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { SECURITY_CREDENTIALS_DOC_LINK } from './Credentials.constants';
import { Messages } from './Credentials.messages';
import { getStyles } from './Credentials.styles';
const Credentials = ({ onSetCredentials, selectInstance }) => {
    const styles = useStyles(getStyles);
    const onSubmit = useCallback((values) => {
        onSetCredentials(Object.assign({}, values));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (React.createElement(FormFinal, { onSubmit: onSubmit, render: ({ handleSubmit }) => (React.createElement("form", { id: "add-instance-form", onSubmit: handleSubmit, className: styles.instanceForm },
            React.createElement("div", { className: styles.searchPanel },
                React.createElement(TextInputField, { name: Messages.form.fields.clientId.name, placeholder: Messages.form.fields.clientId.placeholder, label: Messages.form.fields.clientId.label, validators: [validators.required], fieldClassName: styles.credentialsField }),
                React.createElement(PasswordInputField, { name: Messages.form.fields.clientSecret.name, placeholder: Messages.form.fields.clientSecret.placeholder, label: Messages.form.fields.clientSecret.label, validators: [validators.required], fieldClassName: styles.credentialsField })),
            React.createElement("div", { className: styles.searchPanel },
                React.createElement(TextInputField, { name: Messages.form.fields.tenantId.name, placeholder: Messages.form.fields.tenantId.placeholder, label: Messages.form.fields.tenantId.label, validators: [validators.required], fieldClassName: styles.credentialsField }),
                React.createElement(TextInputField, { name: Messages.form.fields.subscriptionId.name, placeholder: Messages.form.fields.subscriptionId.placeholder, label: Messages.form.fields.subscriptionId.label, validators: [validators.required], fieldClassName: styles.credentialsField })),
            React.createElement("div", { className: styles.searchPanel },
                React.createElement(Button, { type: "button", fill: "text", onClick: () => window.open(SECURITY_CREDENTIALS_DOC_LINK, '_blank') }, Messages.form.credentialsDocLink)),
            React.createElement("div", null))) }));
};
export default Credentials;
//# sourceMappingURL=Credentials.js.map