import React, { useState } from 'react';
import { onUpdateDatasourceJsonDataOption, onUpdateDatasourceSecureJsonDataOption, updateDatasourcePluginJsonDataOption, updateDatasourcePluginResetOption, } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, InlineSwitch, FieldSet, InlineField, InlineFieldRow, Input, Select, SecretInput, Link, } from '@grafana/ui';
import { ConnectionLimits } from 'app/features/plugins/sql/components/configuration/ConnectionLimits';
import { TLSSecretsConfig } from 'app/features/plugins/sql/components/configuration/TLSSecretsConfig';
import { useMigrateDatabaseFields } from 'app/features/plugins/sql/components/configuration/useMigrateDatabaseFields';
import { PostgresTLSMethods, PostgresTLSModes } from '../types';
import { useAutoDetectFeatures } from './useAutoDetectFeatures';
export const postgresVersions = [
    { label: '9.0', value: 900 },
    { label: '9.1', value: 901 },
    { label: '9.2', value: 902 },
    { label: '9.3', value: 903 },
    { label: '9.4', value: 904 },
    { label: '9.5', value: 905 },
    { label: '9.6', value: 906 },
    { label: '10', value: 1000 },
    { label: '11', value: 1100 },
    { label: '12', value: 1200 },
    { label: '13', value: 1300 },
    { label: '14', value: 1400 },
    { label: '15', value: 1500 },
];
export const PostgresConfigEditor = (props) => {
    var _a, _b;
    const [versionOptions, setVersionOptions] = useState(postgresVersions);
    useAutoDetectFeatures({ props, setVersionOptions });
    useMigrateDatabaseFields(props);
    const { options, onOptionsChange } = props;
    const jsonData = options.jsonData;
    const onResetPassword = () => {
        updateDatasourcePluginResetOption(props, 'password');
    };
    const tlsModes = [
        { value: PostgresTLSModes.disable, label: 'disable' },
        { value: PostgresTLSModes.require, label: 'require' },
        { value: PostgresTLSModes.verifyCA, label: 'verify-ca' },
        { value: PostgresTLSModes.verifyFull, label: 'verify-full' },
    ];
    const tlsMethods = [
        { value: PostgresTLSMethods.filePath, label: 'File system path' },
        { value: PostgresTLSMethods.fileContent, label: 'Certificate content' },
    ];
    const onJSONDataOptionSelected = (property) => {
        return (value) => {
            updateDatasourcePluginJsonDataOption(props, property, value.value);
        };
    };
    const onTimeScaleDBChanged = (event) => {
        updateDatasourcePluginJsonDataOption(props, 'timescaledb', event.currentTarget.checked);
    };
    const onDSOptionChanged = (property) => {
        return (event) => {
            onOptionsChange(Object.assign(Object.assign({}, options), { [property]: event.currentTarget.value }));
        };
    };
    const labelWidthSSLDetails = 25;
    const labelWidthConnection = 20;
    const labelWidthShort = 20;
    return (React.createElement(React.Fragment, null,
        React.createElement(FieldSet, { label: "PostgreSQL Connection", width: 400 },
            React.createElement(InlineField, { labelWidth: labelWidthConnection, label: "Host" },
                React.createElement(Input, { width: 40, name: "host", type: "text", value: options.url || '', placeholder: "localhost:5432", onChange: onDSOptionChanged('url') })),
            React.createElement(InlineField, { labelWidth: labelWidthConnection, label: "Database" },
                React.createElement(Input, { width: 40, name: "database", value: jsonData.database || '', placeholder: "database name", onChange: onUpdateDatasourceJsonDataOption(props, 'database') })),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { labelWidth: labelWidthConnection, label: "User" },
                    React.createElement(Input, { value: options.user || '', placeholder: "user", onChange: onDSOptionChanged('user') })),
                React.createElement(InlineField, { label: "Password" },
                    React.createElement(SecretInput, { placeholder: "Password", isConfigured: (_a = options.secureJsonFields) === null || _a === void 0 ? void 0 : _a.password, onReset: onResetPassword, onBlur: onUpdateDatasourceSecureJsonDataOption(props, 'password') }))),
            React.createElement(InlineField, { labelWidth: labelWidthConnection, label: "TLS/SSL Mode", htmlFor: "tlsMode", tooltip: "This option determines whether or with what priority a secure TLS/SSL TCP/IP connection will be negotiated with the server." },
                React.createElement(Select, { options: tlsModes, inputId: "tlsMode", value: jsonData.sslmode || PostgresTLSModes.verifyFull, onChange: onJSONDataOptionSelected('sslmode') })),
            options.jsonData.sslmode !== PostgresTLSModes.disable ? (React.createElement(InlineField, { labelWidth: labelWidthConnection, label: "TLS/SSL Method", htmlFor: "tlsMethod", tooltip: React.createElement("span", null,
                    "This option determines how TLS/SSL certifications are configured. Selecting ",
                    React.createElement("i", null, "File system path"),
                    " will allow you to configure certificates by specifying paths to existing certificates on the local file system where Grafana is running. Be sure that the file is readable by the user executing the Grafana process.",
                    React.createElement("br", null),
                    React.createElement("br", null),
                    "Selecting ",
                    React.createElement("i", null, "Certificate content"),
                    " will allow you to configure certificates by specifying its content. The content will be stored encrypted in Grafana's database. When connecting to the database the certificates will be written as files to Grafana's configured data path on the local file system.") },
                React.createElement(Select, { options: tlsMethods, inputId: "tlsMethod", value: jsonData.tlsConfigurationMethod || PostgresTLSMethods.filePath, onChange: onJSONDataOptionSelected('tlsConfigurationMethod') }))) : null),
        config.secureSocksDSProxyEnabled && (React.createElement(FieldSet, { label: "Secure Socks Proxy" },
            React.createElement(InlineField, { labelWidth: 26, label: "Enabled", tooltip: "Connect to this datasource via the secure socks proxy." },
                React.createElement(InlineSwitch, { value: (_b = options.jsonData.enableSecureSocksProxy) !== null && _b !== void 0 ? _b : false, onChange: (event) => onOptionsChange(Object.assign(Object.assign({}, options), { jsonData: Object.assign(Object.assign({}, options.jsonData), { enableSecureSocksProxy: event.currentTarget.checked }) })) })))),
        jsonData.sslmode !== PostgresTLSModes.disable ? (React.createElement(FieldSet, { label: "TLS/SSL Auth Details" }, jsonData.tlsConfigurationMethod === PostgresTLSMethods.fileContent ? (React.createElement(TLSSecretsConfig, { showCACert: jsonData.sslmode === PostgresTLSModes.verifyCA || jsonData.sslmode === PostgresTLSModes.verifyFull, editorProps: props, labelWidth: labelWidthSSLDetails })) : (React.createElement(React.Fragment, null,
            React.createElement(InlineField, { tooltip: React.createElement("span", null, "If the selected TLS/SSL mode requires a server root certificate, provide the path to the file here."), labelWidth: labelWidthSSLDetails, label: "TLS/SSL Root Certificate" },
                React.createElement(Input, { value: jsonData.sslRootCertFile || '', onChange: onUpdateDatasourceJsonDataOption(props, 'sslRootCertFile'), placeholder: "TLS/SSL root cert file" })),
            React.createElement(InlineField, { tooltip: React.createElement("span", null, "To authenticate with an TLS/SSL client certificate, provide the path to the file here. Be sure that the file is readable by the user executing the grafana process."), labelWidth: labelWidthSSLDetails, label: "TLS/SSL Client Certificate" },
                React.createElement(Input, { value: jsonData.sslCertFile || '', onChange: onUpdateDatasourceJsonDataOption(props, 'sslCertFile'), placeholder: "TLS/SSL client cert file" })),
            React.createElement(InlineField, { tooltip: React.createElement("span", null,
                    "To authenticate with a client TLS/SSL certificate, provide the path to the corresponding key file here. Be sure that the file is ",
                    React.createElement("i", null, "only"),
                    " readable by the user executing the grafana process."), labelWidth: labelWidthSSLDetails, label: "TLS/SSL Client Key" },
                React.createElement(Input, { value: jsonData.sslKeyFile || '', onChange: onUpdateDatasourceJsonDataOption(props, 'sslKeyFile'), placeholder: "TLS/SSL client key file" })))))) : null,
        React.createElement(ConnectionLimits, { options: options, onOptionsChange: onOptionsChange }),
        React.createElement(FieldSet, { label: "PostgreSQL details" },
            React.createElement(InlineField, { tooltip: "This option controls what functions are available in the PostgreSQL query builder", labelWidth: labelWidthShort, htmlFor: "postgresVersion", label: "Version" },
                React.createElement(Select, { value: jsonData.postgresVersion || 903, inputId: "postgresVersion", onChange: onJSONDataOptionSelected('postgresVersion'), options: versionOptions })),
            React.createElement(InlineField, { tooltip: React.createElement("span", null,
                    "TimescaleDB is a time-series database built as a PostgreSQL extension. If enabled, Grafana will use",
                    React.createElement("code", null, "time_bucket"),
                    " in the ",
                    React.createElement("code", null, "$__timeGroup"),
                    " macro and display TimescaleDB specific aggregate functions in the query builder."), labelWidth: labelWidthShort, label: "TimescaleDB", htmlFor: "timescaledb" },
                React.createElement(InlineSwitch, { id: "timescaledb", value: jsonData.timescaledb || false, onChange: onTimeScaleDBChanged })),
            React.createElement(InlineField, { tooltip: React.createElement("span", null,
                    "A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example",
                    React.createElement("code", null, "1m"),
                    " if your data is written every minute."), labelWidth: labelWidthShort, label: "Min time interval" },
                React.createElement(Input, { placeholder: "1m", value: jsonData.timeInterval || '', onChange: onUpdateDatasourceJsonDataOption(props, 'timeInterval') }))),
        React.createElement(Alert, { title: "User Permission", severity: "info" },
            "The database user should only be granted SELECT permissions on the specified database & tables you want to query. Grafana does not validate that queries are safe so queries can contain any SQL statement. For example, statements like ",
            React.createElement("code", null, "DELETE FROM user;"),
            " and ",
            React.createElement("code", null, "DROP TABLE user;"),
            " would be executed. To protect against this we ",
            React.createElement("strong", null, "Highly"),
            " recommend you create a specific PostgreSQL user with restricted permissions. Check out the",
            ' ',
            React.createElement(Link, { rel: "noreferrer", target: "_blank", href: "http://docs.grafana.org/features/datasources/postgres/" }, "PostgreSQL Data Source Docs"),
            ' ',
            "for more information.")));
};
//# sourceMappingURL=ConfigurationEditor.js.map