import { cx } from '@emotion/css';
import React from 'react';
import { Form } from 'react-final-form';
import { Button, useStyles2 } from '@grafana/ui';
import { PMMServerUrlWarning } from 'app/percona/dbaas/components/PMMServerURLWarning/PMMServerUrlWarning';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { useShowPMMAddressWarning } from 'app/percona/shared/components/hooks/showPMMAddressWarning';
import { getPerconaServer } from 'app/percona/shared/core/selectors';
import validators from 'app/percona/shared/helpers/validators';
import { useSelector } from 'app/types';
import { Messages } from '../Platform.messages';
import { getStyles } from './Connect.styles';
export const Connect = ({ onConnect, connecting, initialValues }) => {
    const styles = useStyles2(getStyles);
    const { saasHost } = useSelector(getPerconaServer);
    const [showPMMAddressWarning] = useShowPMMAddressWarning();
    const ConnectForm = ({ valid, handleSubmit }) => (React.createElement(React.Fragment, null,
        React.createElement("h2", { className: styles.titles }, Messages.perconaPlatform),
        React.createElement("h4", null, Messages.whatIsPerconaPlatform),
        React.createElement("p", null, Messages.perconaPlatformExplanation),
        React.createElement("h4", null, Messages.whyConnect),
        React.createElement("p", null, Messages.connectionReason),
        React.createElement("h4", null, Messages.noPerconaAccount),
        React.createElement("p", null, Messages.createAnAccount),
        React.createElement("a", { href: `${saasHost}/login`, rel: "noreferrer noopener", target: "_blank" },
            React.createElement(Button, { variant: "secondary", icon: "external-link-alt" }, Messages.createPerconaAccountAnchor)),
        React.createElement("h2", { className: cx(styles.titles, styles.connectionTitle) }, Messages.connectTitle),
        React.createElement("form", { "data-testid": "connect-form", className: styles.form, onSubmit: handleSubmit, autoComplete: "off" },
            React.createElement("div", { className: styles.serverDetails },
                React.createElement(TextInputField, { name: "pmmServerId", disabled: true, label: Messages.pmmServerId }),
                React.createElement(TextInputField, { name: "pmmServerName", label: Messages.pmmServerName, validators: [validators.required], showErrorOnBlur: true, required: true, disabled: connecting })),
            React.createElement("div", { className: styles.accessTokenRow },
                React.createElement(TextInputField, { name: "accessToken", label: Messages.accessToken, validators: [validators.required], placeholder: Messages.tokenHerePlaceholder, showErrorOnBlur: true, required: true, disabled: connecting }),
                React.createElement("a", { href: `${saasHost}/profile`, rel: "noreferrer noopener", target: "_blank", className: styles.getTokenAnchor },
                    React.createElement(Button, { variant: "secondary", fill: "text", icon: "external-link-alt" }, Messages.getToken))),
            showPMMAddressWarning && React.createElement(PMMServerUrlWarning, null),
            React.createElement(LoaderButton, { "data-testid": "connect-button", type: "submit", size: "md", variant: "primary", disabled: connecting, loading: connecting, className: styles.submitButton }, Messages.connect))));
    return (React.createElement(Form, { onSubmit: (values) => onConnect(values, showPMMAddressWarning), initialValues: initialValues, render: ConnectForm }));
};
//# sourceMappingURL=Connect.js.map