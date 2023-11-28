import React from 'react';
import { PasswordInputField } from 'app/percona/shared/components/Form/PasswordInput';
import { TextareaInputField } from 'app/percona/shared/components/Form/TextareaInput';
import { Messages } from '../FormParts.messages';
export const MongodbTLSCertificate = ({ form }) => {
    const tlsFlag = form.getState().values && form.getState().values['tls'];
    return (React.createElement(React.Fragment, null, tlsFlag ? (React.createElement(React.Fragment, null,
        React.createElement(PasswordInputField, { name: "tls_certificate_file_password", label: Messages.form.labels.additionalOptions.tlsCertificateFilePassword }),
        React.createElement(TextareaInputField, { name: "tls_certificate_key", tooltipIcon: "info-circle", label: Messages.form.labels.additionalOptions.tlsCertificateKey, tooltipText: Messages.form.labels.tooltips.tlsCertificateKey }),
        React.createElement(TextareaInputField, { name: "tls_ca", label: Messages.form.labels.additionalOptions.tlsCA, tooltipIcon: "info-circle", tooltipText: Messages.form.labels.tooltips.tlsCA }))) : null));
};
//# sourceMappingURL=MongodbTLSCertificate.js.map