import React from 'react';
import { onUpdateDatasourceSecureJsonDataOption, updateDatasourcePluginResetOption, } from '@grafana/data';
import { InlineField, SecretTextArea } from '@grafana/ui';
export const TLSSecretsConfig = (props) => {
    const { labelWidth, editorProps, showCACert, showKeyPair = true } = props;
    const { secureJsonFields } = editorProps.options;
    return (React.createElement(React.Fragment, null,
        showKeyPair ? (React.createElement(InlineField, { tooltip: React.createElement("span", null, "To authenticate with an TLS/SSL client certificate, provide the client certificate here."), labelWidth: labelWidth, label: "TLS/SSL Client Certificate" },
            React.createElement(SecretTextArea, { placeholder: "Begins with -----BEGIN CERTIFICATE-----", cols: 45, rows: 7, isConfigured: secureJsonFields && secureJsonFields.tlsClientCert, onChange: onUpdateDatasourceSecureJsonDataOption(editorProps, 'tlsClientCert'), onReset: () => {
                    updateDatasourcePluginResetOption(editorProps, 'tlsClientCert');
                } }))) : null,
        showCACert ? (React.createElement(InlineField, { tooltip: React.createElement("span", null, "If the selected TLS/SSL mode requires a server root certificate, provide it here."), labelWidth: labelWidth, label: "TLS/SSL Root Certificate" },
            React.createElement(SecretTextArea, { placeholder: "Begins with -----BEGIN CERTIFICATE-----", cols: 45, rows: 7, isConfigured: secureJsonFields && secureJsonFields.tlsCACert, onChange: onUpdateDatasourceSecureJsonDataOption(editorProps, 'tlsCACert'), onReset: () => {
                    updateDatasourcePluginResetOption(editorProps, 'tlsCACert');
                } }))) : null,
        showKeyPair ? (React.createElement(InlineField, { tooltip: React.createElement("span", null, "To authenticate with a client TLS/SSL certificate, provide the key here."), labelWidth: labelWidth, label: "TLS/SSL Client Key" },
            React.createElement(SecretTextArea, { placeholder: "Begins with -----BEGIN RSA PRIVATE KEY-----", cols: 45, rows: 7, isConfigured: secureJsonFields && secureJsonFields.tlsClientKey, onChange: onUpdateDatasourceSecureJsonDataOption(editorProps, 'tlsClientKey'), onReset: () => {
                    updateDatasourcePluginResetOption(editorProps, 'tlsClientKey');
                } }))) : null));
};
//# sourceMappingURL=TLSSecretsConfig.js.map