import React, { useMemo } from 'react';
import { useStyles2 } from '@grafana/ui';
import { PasswordInputField } from 'app/percona/shared/components/Form/PasswordInput';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import Validators from 'app/percona/shared/helpers/validators';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { Messages } from '../FormParts.messages';
import { getStyles } from '../FormParts.styles';
export const MongoDBConnectionDetails = ({ form, remoteInstanceCredentials }) => {
    const styles = useStyles2(getStyles);
    const formValues = form && form.getState().values;
    const tlsFlag = formValues && formValues['tls'];
    const portValidators = useMemo(() => [validators.required, Validators.validatePort], []);
    const userPassValidators = useMemo(() => (tlsFlag ? [] : [validators.required]), [tlsFlag]);
    const maxQueryLengthValidators = useMemo(() => [Validators.min(-1)], []);
    return (React.createElement("div", { className: styles.groupWrapper },
        React.createElement("h4", { className: styles.sectionHeader }, Messages.form.titles.mainDetails),
        React.createElement("div", { className: styles.group },
            React.createElement(TextInputField, { name: "serviceName", label: Messages.form.labels.mainDetails.serviceName, tooltipLinkText: Messages.form.tooltips.mainDetails.serviceName, placeholder: Messages.form.placeholders.mainDetails.serviceName }),
            React.createElement("div", null)),
        React.createElement("div", { className: styles.group },
            React.createElement(TextInputField, { name: "address", label: Messages.form.labels.mainDetails.address, tooltipText: Messages.form.tooltips.mainDetails.address, placeholder: Messages.form.placeholders.mainDetails.address, validators: [validators.required], disabled: remoteInstanceCredentials.isRDS }),
            React.createElement(TextInputField, { name: "port", label: Messages.form.labels.mainDetails.port, tooltipText: Messages.form.tooltips.mainDetails.port, placeholder: `Port (default: ${remoteInstanceCredentials.port} )`, validators: portValidators })),
        React.createElement("div", { className: styles.group },
            React.createElement(TextInputField, { key: `username-${tlsFlag}`, name: "username", label: Messages.form.labels.mainDetails.username, tooltipText: Messages.form.tooltips.mainDetails.username, placeholder: Messages.form.placeholders.mainDetails.username, validators: userPassValidators }),
            React.createElement(PasswordInputField, { key: `password-${tlsFlag}`, name: "password", label: Messages.form.labels.mainDetails.password, tooltipText: Messages.form.tooltips.mainDetails.password, placeholder: Messages.form.placeholders.mainDetails.password, validators: userPassValidators })),
        React.createElement("div", { className: styles.group },
            React.createElement(TextInputField, { key: "maxQueryLength", name: "maxQueryLength", label: Messages.form.labels.mongodbDetails.maxQueryLength, tooltipText: Messages.form.tooltips.mongodbDetails.maxQueryLength, placeholder: Messages.form.placeholders.mongodbDetails.maxQueryLength, validators: maxQueryLengthValidators }),
            React.createElement("div", null))));
};
//# sourceMappingURL=MongoDBConnectionDetails.js.map