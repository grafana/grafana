import React, { useCallback, useMemo } from 'react';
import { useStyles2 } from '@grafana/ui';
import { PasswordInputField } from 'app/percona/shared/components/Form/PasswordInput';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import Validators from 'app/percona/shared/helpers/validators';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { Messages } from '../FormParts.messages';
import { getStyles } from '../FormParts.styles';
export const HAProxyConnectionDetails = ({ remoteInstanceCredentials }) => {
    const styles = useStyles2(getStyles);
    const portValidators = useMemo(() => [validators.required, Validators.validatePort], []);
    const trim = useCallback((value) => (value ? value.trim() : value), []);
    return (React.createElement("div", { className: styles.groupWrapper },
        React.createElement("h4", { className: styles.sectionHeader }, Messages.form.titles.mainDetails),
        React.createElement("div", { className: styles.group },
            React.createElement(TextInputField, { name: "serviceName", initialValue: "", label: Messages.form.labels.mainDetails.serviceName, tooltipText: Messages.form.tooltips.mainDetails.serviceName, placeholder: Messages.form.placeholders.mainDetails.serviceName }),
            React.createElement("div", null)),
        React.createElement("div", { className: styles.group },
            React.createElement(TextInputField, { name: "address", initialValue: "", label: Messages.form.labels.mainDetails.address, tooltipText: Messages.form.tooltips.mainDetails.address, placeholder: Messages.form.placeholders.mainDetails.address, validators: [validators.required] }),
            React.createElement(TextInputField, { name: "port", initialValue: "", label: Messages.form.labels.mainDetails.port, tooltipText: Messages.form.tooltips.haproxy.port, placeholder: `Port (default: ${remoteInstanceCredentials.port} )`, validators: portValidators })),
        React.createElement("div", { className: styles.group },
            React.createElement(TextInputField, { name: "username", initialValue: "", label: Messages.form.labels.mainDetails.username, tooltipText: Messages.form.tooltips.haproxy.username, placeholder: Messages.form.placeholders.mainDetails.username, format: trim }),
            React.createElement(PasswordInputField, { name: "password", initialValue: "", label: Messages.form.labels.mainDetails.password, tooltipText: Messages.form.tooltips.haproxy.password, placeholder: Messages.form.placeholders.mainDetails.password, format: trim }))));
};
//# sourceMappingURL=HAProxyConnectionDetails.js.map