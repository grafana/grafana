import React, { useCallback } from 'react';
import { Form as FormFinal } from 'react-final-form';
import { useStyles } from '@grafana/ui';
import { ADD_INSTANCE_FORM_NAME } from 'app/percona/add-instance/panel.constants';
import { PasswordInputField } from 'app/percona/shared/components/Form/PasswordInput';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { Messages } from './Credentials.messages';
import { getStyles } from './Credentials.styles';
const Credentials = ({ discover }) => {
    const styles = useStyles(getStyles);
    const onSubmit = useCallback((values) => {
        discover(values);
    }, [discover]);
    return (React.createElement(FormFinal, { onSubmit: onSubmit, render: ({ handleSubmit }) => (React.createElement("form", { id: ADD_INSTANCE_FORM_NAME, onSubmit: handleSubmit, className: styles.instanceForm, "data-testid": "credentials-form" },
            React.createElement("div", { className: styles.fieldsWrapper },
                React.createElement(TextInputField, { name: Messages.form.fields.awsAccessKey.name, placeholder: Messages.form.fields.awsAccessKey.placeholder, label: Messages.form.fields.awsAccessKey.label, fieldClassName: styles.credentialsField }),
                React.createElement(PasswordInputField, { name: Messages.form.fields.awsSecretKey.name, placeholder: Messages.form.fields.awsSecretKey.placeholder, label: Messages.form.fields.awsSecretKey.label, fieldClassName: styles.credentialsField })))) }));
};
export default Credentials;
//# sourceMappingURL=Credentials.js.map