import React from 'react';
import { TextareaInputField } from 'app/percona/shared/components/Form/TextareaInput';
import { Messages } from '../FormParts.messages';
export const PostgreTLSCertificate = ({ form }) => {
    const values = form.getState().values;
    const tlsFlag = values && values['tls'];
    return (React.createElement(React.Fragment, null, tlsFlag ? (React.createElement(React.Fragment, null,
        React.createElement(TextareaInputField, { name: "tls_ca", label: Messages.form.labels.additionalOptions.tlsCA, tooltipIcon: "info-circle", tooltipText: Messages.form.labels.tooltips.tlsCA }),
        React.createElement(TextareaInputField, { name: "tls_key", label: Messages.form.labels.additionalOptions.tlsCertificateKey, tooltipIcon: "info-circle", tooltipText: Messages.form.labels.tooltips.tlsCertificateKey }),
        React.createElement(TextareaInputField, { name: "tls_cert", label: Messages.form.labels.additionalOptions.tlsCertificate, tooltipIcon: "info-circle", tooltipText: Messages.form.labels.tooltips.tlsCertificate }))) : null));
};
//# sourceMappingURL=PostgreTLSCertificate.js.map