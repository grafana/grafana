import React, { useMemo } from 'react';
import { useStyles2 } from '@grafana/ui';
import { PasswordInputField } from 'app/percona/shared/components/Form/PasswordInput';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import Validators from 'app/percona/shared/helpers/validators';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { Messages } from '../FormParts.messages';
import { getStyles } from '../FormParts.styles';
export const PostgreSQLConnectionDetails = ({ form, remoteInstanceCredentials }) => {
    const styles = useStyles2(getStyles);
    const formValues = form && form.getState().values;
    const tlsFlag = formValues && formValues['tls'];
    const portValidators = useMemo(() => [validators.required, Validators.validatePort], []);
    const userPassValidators = useMemo(() => (tlsFlag ? [] : [validators.required]), [tlsFlag]);
    const maxQueryLengthValidators = useMemo(() => [Validators.min(-1)], []);
    return (React.createElement("div", { className: styles.groupWrapper },
        React.createElement("h4", { className: styles.sectionHeader }, Messages.form.titles.mainDetails),
        React.createElement("div", { className: styles.group },
            React.createElement(TextInputField, { name: "serviceName", placeholder: Messages.form.placeholders.mainDetails.serviceName, label: Messages.form.labels.mainDetails.serviceName, tooltipText: Messages.form.tooltips.mainDetails.serviceName }),
            React.createElement("div", null)),
        React.createElement("div", { className: styles.group },
            React.createElement(TextInputField, { name: "address", placeholder: Messages.form.placeholders.mainDetails.address, validators: [validators.required], disabled: remoteInstanceCredentials.isRDS, label: Messages.form.labels.mainDetails.address, tooltipText: Messages.form.tooltips.mainDetails.address }),
            React.createElement(TextInputField, { name: "port", placeholder: `Port (default: ${remoteInstanceCredentials.port} )`, validators: portValidators, label: Messages.form.labels.mainDetails.port, tooltipText: Messages.form.tooltips.mainDetails.port })),
        React.createElement("div", { className: styles.group },
            React.createElement(TextInputField, { key: `username-${tlsFlag}`, name: "username", placeholder: Messages.form.placeholders.mainDetails.username, validators: userPassValidators, label: Messages.form.labels.mainDetails.username, tooltipText: Messages.form.tooltips.mainDetails.username }),
            React.createElement(PasswordInputField, { key: `password-${tlsFlag}`, name: "password", placeholder: Messages.form.placeholders.mainDetails.password, validators: userPassValidators, label: Messages.form.labels.mainDetails.password, tooltipText: Messages.form.tooltips.mainDetails.password })),
        React.createElement("div", { className: styles.group },
            React.createElement(TextInputField, { key: "database", name: "database", placeholder: Messages.form.placeholders.postgresqlDetails.database, label: Messages.form.labels.postgresqlDetails.database, tooltipText: Messages.form.tooltips.postgresqlDetails.database }),
            React.createElement(TextInputField, { key: "maxQueryLength", name: "maxQueryLength", placeholder: Messages.form.placeholders.postgresqlDetails.maxQueryLength, validators: maxQueryLengthValidators, label: Messages.form.labels.postgresqlDetails.maxQueryLength, tooltipText: Messages.form.tooltips.postgresqlDetails.maxQueryLength }))));
};
//# sourceMappingURL=PostgreSQLConnectionDetails.js.map