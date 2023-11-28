import { css } from '@emotion/css';
import React from 'react';
import { onUpdateDatasourceJsonDataOption, onUpdateDatasourceSecureJsonDataOption, updateDatasourcePluginJsonDataOption, updateDatasourcePluginResetOption, } from '@grafana/data';
import { ConfigSection, ConfigSubSection, DataSourceDescription } from '@grafana/experimental';
import { Alert, FieldSet, Input, Link, SecretInput, Select, useStyles2, SecureSocksProxySettings, Divider, Field, Switch, } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';
import { config } from 'app/core/config';
import { ConnectionLimits } from 'app/features/plugins/sql/components/configuration/ConnectionLimits';
import { useMigrateDatabaseFields } from 'app/features/plugins/sql/components/configuration/useMigrateDatabaseFields';
import { AzureAuthSettings } from '../azureauth/AzureAuthSettings';
import { MSSQLAuthenticationType, MSSQLEncryptOptions, } from '../types';
const LONG_WIDTH = 40;
export const ConfigurationEditor = (props) => {
    var _a;
    useMigrateDatabaseFields(props);
    const { options: dsSettings, onOptionsChange } = props;
    const styles = useStyles2(getStyles);
    const jsonData = dsSettings.jsonData;
    const azureAuthIsSupported = config.azureAuthEnabled;
    const azureAuthSettings = {
        azureAuthIsSupported,
        azureAuthSettingsUI: AzureAuthSettings,
    };
    const onResetPassword = () => {
        updateDatasourcePluginResetOption(props, 'password');
    };
    const onDSOptionChanged = (property) => {
        return (event) => {
            onOptionsChange(Object.assign(Object.assign({}, dsSettings), { [property]: event.currentTarget.value }));
        };
    };
    const onSkipTLSVerifyChanged = (event) => {
        updateDatasourcePluginJsonDataOption(props, 'tlsSkipVerify', event.currentTarget.checked);
    };
    const onEncryptChanged = (value) => {
        updateDatasourcePluginJsonDataOption(props, 'encrypt', value.value);
    };
    const onAuthenticationMethodChanged = (value) => {
        onOptionsChange(Object.assign(Object.assign({}, dsSettings), {
            jsonData: Object.assign(Object.assign(Object.assign({}, jsonData), { authenticationType: value.value }), { azureCredentials: undefined }),
            secureJsonData: Object.assign(Object.assign({}, dsSettings.secureJsonData), { password: '' }),
            secureJsonFields: Object.assign(Object.assign({}, dsSettings.secureJsonFields), { password: false }),
            user: '',
        }));
    };
    const onConnectionTimeoutChanged = (connectionTimeout) => {
        updateDatasourcePluginJsonDataOption(props, 'connectionTimeout', connectionTimeout !== null && connectionTimeout !== void 0 ? connectionTimeout : 0);
    };
    const buildAuthenticationOptions = () => {
        const basicAuthenticationOptions = [
            { value: MSSQLAuthenticationType.sqlAuth, label: 'SQL Server Authentication' },
            { value: MSSQLAuthenticationType.windowsAuth, label: 'Windows Authentication' },
        ];
        if (azureAuthIsSupported) {
            return [
                ...basicAuthenticationOptions,
                { value: MSSQLAuthenticationType.azureAuth, label: 'Azure AD Authentication' },
            ];
        }
        return basicAuthenticationOptions;
    };
    const encryptOptions = [
        { value: MSSQLEncryptOptions.disable, label: 'disable' },
        { value: MSSQLEncryptOptions.false, label: 'false' },
        { value: MSSQLEncryptOptions.true, label: 'true' },
    ];
    return (React.createElement(React.Fragment, null,
        React.createElement(DataSourceDescription, { dataSourceName: "Microsoft SQL Server", docsLink: "https://grafana.com/docs/grafana/latest/datasources/mssql/", hasRequiredFields: true }),
        React.createElement(Alert, { title: "User Permission", severity: "info" },
            "The database user should only be granted SELECT permissions on the specified database and tables you want to query. Grafana does not validate that queries are safe so queries can contain any SQL statement. For example, statements like ",
            React.createElement("code", null, "USE otherdb;"),
            " and ",
            React.createElement("code", null, "DROP TABLE user;"),
            " would be executed. To protect against this we ",
            React.createElement("em", null, "highly"),
            " recommend you create a specific MS SQL user with restricted permissions. Check out the",
            ' ',
            React.createElement(Link, { rel: "noreferrer", target: "_blank", href: "http://docs.grafana.org/features/datasources/mssql/" }, "Microsoft SQL Server Data Source Docs"),
            ' ',
            "for more information."),
        React.createElement(Divider, null),
        React.createElement(ConfigSection, { title: "Connection" },
            React.createElement(Field, { label: "Host", required: true, invalid: !dsSettings.url, error: 'Host is required' },
                React.createElement(Input, { width: LONG_WIDTH, name: "host", type: "text", value: dsSettings.url || '', placeholder: "localhost:1433", onChange: onDSOptionChanged('url') })),
            React.createElement(Field, { label: "Database", required: true, invalid: !jsonData.database, error: 'Database is required' },
                React.createElement(Input, { width: LONG_WIDTH, name: "database", value: jsonData.database || '', placeholder: "database name", onChange: onUpdateDatasourceJsonDataOption(props, 'database') }))),
        React.createElement(ConfigSection, { title: "TLS/SSL Auth" },
            React.createElement(Field, { htmlFor: "encrypt", description: React.createElement(React.Fragment, null,
                    "Determines whether or to which extent a secure SSL TCP/IP connection will be negotiated with the server.",
                    React.createElement("ul", { className: styles.ulPadding },
                        React.createElement("li", null,
                            React.createElement("i", null, "disable"),
                            " - Data sent between client and server is not encrypted."),
                        React.createElement("li", null,
                            React.createElement("i", null, "false"),
                            " - Data sent between client and server is not encrypted beyond the login packet. (default)"),
                        React.createElement("li", null,
                            React.createElement("i", null, "true"),
                            " - Data sent between client and server is encrypted.")),
                    "If you're using an older version of Microsoft SQL Server like 2008 and 2008R2 you may need to disable encryption to be able to connect."), label: "Encrypt" },
                React.createElement(Select, { options: encryptOptions, value: jsonData.encrypt || MSSQLEncryptOptions.false, inputId: "encrypt", onChange: onEncryptChanged, width: LONG_WIDTH })),
            jsonData.encrypt === MSSQLEncryptOptions.true ? (React.createElement(React.Fragment, null,
                React.createElement(Field, { htmlFor: "skipTlsVerify", label: "Skip TLS Verify" },
                    React.createElement(Switch, { id: "skipTlsVerify", onChange: onSkipTLSVerifyChanged, value: jsonData.tlsSkipVerify || false })),
                jsonData.tlsSkipVerify ? null : (React.createElement(React.Fragment, null,
                    React.createElement(Field, { description: React.createElement("span", null, "Path to file containing the public key certificate of the CA that signed the SQL Server certificate. Needed when the server certificate is self signed."), label: "TLS/SSL Root Certificate" },
                        React.createElement(Input, { value: jsonData.sslRootCertFile || '', onChange: onUpdateDatasourceJsonDataOption(props, 'sslRootCertFile'), placeholder: "TLS/SSL root certificate file path", width: LONG_WIDTH })),
                    React.createElement(Field, { label: "Hostname in server certificate" },
                        React.createElement(Input, { placeholder: "Common Name (CN) in server certificate", value: jsonData.serverName || '', onChange: onUpdateDatasourceJsonDataOption(props, 'serverName'), width: LONG_WIDTH })))))) : null),
        React.createElement(ConfigSection, { title: "Authentication" },
            React.createElement(Field, { label: "Authentication Type", htmlFor: "authenticationType", description: React.createElement("ul", { className: styles.ulPadding },
                    React.createElement("li", null,
                        React.createElement("i", null, "SQL Server Authentication"),
                        " This is the default mechanism to connect to MS SQL Server. Enter the SQL Server Authentication login or the Windows Authentication login in the DOMAIN\\User format."),
                    React.createElement("li", null,
                        React.createElement("i", null, "Windows Authentication"),
                        " Windows Integrated Security - single sign on for users who are already logged onto Windows and have enabled this option for MS SQL Server."),
                    azureAuthIsSupported && (React.createElement("li", null,
                        React.createElement("i", null, "Azure Authentication"),
                        " Securely authenticate and access Azure resources and applications using Azure AD credentials - Managed Service Identity and Client Secret Credentials are supported."))) },
                React.createElement(Select
                // Default to basic authentication of none is set
                , { 
                    // Default to basic authentication of none is set
                    value: jsonData.authenticationType || MSSQLAuthenticationType.sqlAuth, inputId: "authenticationType", options: buildAuthenticationOptions(), onChange: onAuthenticationMethodChanged, width: LONG_WIDTH })),
            (jsonData.authenticationType === MSSQLAuthenticationType.sqlAuth || !jsonData.authenticationType) && (React.createElement(React.Fragment, null,
                React.createElement(Field, { label: "Username", required: true, invalid: !dsSettings.user, error: 'Username is required' },
                    React.createElement(Input, { value: dsSettings.user || '', placeholder: "user", onChange: onDSOptionChanged('user'), width: LONG_WIDTH })),
                React.createElement(Field, { label: "Password", required: true, invalid: !dsSettings.secureJsonFields.password && !((_a = dsSettings.secureJsonData) === null || _a === void 0 ? void 0 : _a.password), error: 'Password is required' },
                    React.createElement(SecretInput, { width: LONG_WIDTH, placeholder: "Password", isConfigured: dsSettings.secureJsonFields && dsSettings.secureJsonFields.password, onReset: onResetPassword, onChange: onUpdateDatasourceSecureJsonDataOption(props, 'password'), required: true })))),
            azureAuthIsSupported && jsonData.authenticationType === MSSQLAuthenticationType.azureAuth && (React.createElement(FieldSet, { label: "Azure Authentication Settings" },
                React.createElement(azureAuthSettings.azureAuthSettingsUI, { dataSourceConfig: dsSettings, onChange: onOptionsChange })))),
        React.createElement(Divider, null),
        React.createElement(ConfigSection, { title: "Additional settings", description: "Additional settings are optional settings that can be configured for more control over your data source. This includes connection limits, connection timeout, group-by time interval, and Secure Socks Proxy.", isCollapsible: true, isInitiallyOpen: true },
            React.createElement(ConnectionLimits, { options: dsSettings, onOptionsChange: onOptionsChange }),
            React.createElement(ConfigSubSection, { title: "Connection details" },
                React.createElement(Field, { description: React.createElement("span", null,
                        "A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example",
                        React.createElement("code", null, "1m"),
                        " if your data is written every minute."), label: "Min time interval" },
                    React.createElement(Input, { width: LONG_WIDTH, placeholder: "1m", value: jsonData.timeInterval || '', onChange: onUpdateDatasourceJsonDataOption(props, 'timeInterval') })),
                React.createElement(Field, { description: React.createElement("span", null,
                        "The number of seconds to wait before canceling the request when connecting to the database. The default is ",
                        React.createElement("code", null, "0"),
                        ", meaning no timeout."), label: "Connection timeout" },
                    React.createElement(NumberInput, { width: LONG_WIDTH, placeholder: "60", min: 0, value: jsonData.connectionTimeout, onChange: onConnectionTimeoutChanged }))),
            config.secureSocksDSProxyEnabled && (React.createElement(SecureSocksProxySettings, { options: dsSettings, onOptionsChange: onOptionsChange })))));
};
function getStyles(theme) {
    return {
        ulPadding: css({
            margin: theme.spacing(1, 0),
            paddingLeft: theme.spacing(5),
        }),
    };
}
//# sourceMappingURL=ConfigurationEditor.js.map