import React from 'react';
import { onUpdateDatasourceJsonDataOption, onUpdateDatasourceSecureJsonDataOption, updateDatasourcePluginJsonDataOption, updateDatasourcePluginResetOption, } from '@grafana/data';
import { ConfigSection, DataSourceDescription, Stack } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Alert, Divider, Field, Icon, Input, Label, Link, SecretInput, SecureSocksProxySettings, Switch, Tooltip, } from '@grafana/ui';
import { ConnectionLimits } from 'app/features/plugins/sql/components/configuration/ConnectionLimits';
import { TLSSecretsConfig } from 'app/features/plugins/sql/components/configuration/TLSSecretsConfig';
import { useMigrateDatabaseFields } from 'app/features/plugins/sql/components/configuration/useMigrateDatabaseFields';
export const ConfigurationEditor = (props) => {
    const { options, onOptionsChange } = props;
    const jsonData = options.jsonData;
    useMigrateDatabaseFields(props);
    const onResetPassword = () => {
        updateDatasourcePluginResetOption(props, 'password');
    };
    const onDSOptionChanged = (property) => {
        return (event) => {
            onOptionsChange(Object.assign(Object.assign({}, options), { [property]: event.currentTarget.value }));
        };
    };
    const onSwitchChanged = (property) => {
        return (event) => {
            updateDatasourcePluginJsonDataOption(props, property, event.currentTarget.checked);
        };
    };
    const WIDTH_LONG = 40;
    return (React.createElement(React.Fragment, null,
        React.createElement(DataSourceDescription, { dataSourceName: "MySQL", docsLink: "https://grafana.com/docs/grafana/latest/datasources/mysql/", hasRequiredFields: false }),
        React.createElement(Divider, null),
        React.createElement(ConfigSection, { title: "Connection" },
            React.createElement(Field, { label: "Host URL", required: true },
                React.createElement(Input, { width: WIDTH_LONG, name: "host", type: "text", value: options.url || '', placeholder: "localhost:3306", onChange: onDSOptionChanged('url') }))),
        React.createElement(Divider, null),
        React.createElement(ConfigSection, { title: "Authentication" },
            React.createElement(Field, { label: "Database name" },
                React.createElement(Input, { width: WIDTH_LONG, name: "database", value: jsonData.database || '', placeholder: "Database", onChange: onUpdateDatasourceJsonDataOption(props, 'database') })),
            React.createElement(Field, { label: "Username" },
                React.createElement(Input, { width: WIDTH_LONG, value: options.user || '', placeholder: "Username", onChange: onDSOptionChanged('user') })),
            React.createElement(Field, { label: "Password" },
                React.createElement(SecretInput, { width: WIDTH_LONG, placeholder: "Password", isConfigured: options.secureJsonFields && options.secureJsonFields.password, onReset: onResetPassword, onBlur: onUpdateDatasourceSecureJsonDataOption(props, 'password') })),
            React.createElement(Field, { label: "Use TLS Client Auth", description: "Enables TLS authentication using client cert configured in secure json data." },
                React.createElement(Switch, { onChange: onSwitchChanged('tlsAuth'), value: jsonData.tlsAuth || false })),
            React.createElement(Field, { label: "With CA Cert", description: "Needed for verifying self-signed TLS Certs." },
                React.createElement(Switch, { onChange: onSwitchChanged('tlsAuthWithCACert'), value: jsonData.tlsAuthWithCACert || false })),
            React.createElement(Field, { label: "Skip TLS Verification", description: "When enabled, skips verification of the MySQL server's TLS certificate chain and host name." },
                React.createElement(Switch, { onChange: onSwitchChanged('tlsSkipVerify'), value: jsonData.tlsSkipVerify || false })),
            React.createElement(Field, { label: "Allow Cleartext Passwords", description: "Allows using the cleartext client side plugin if required by an account." },
                React.createElement(Switch, { onChange: onSwitchChanged('allowCleartextPasswords'), value: jsonData.allowCleartextPasswords || false }))),
        config.secureSocksDSProxyEnabled && (React.createElement(React.Fragment, null,
            React.createElement(Divider, null),
            React.createElement(SecureSocksProxySettings, { options: options, onOptionsChange: onOptionsChange }))),
        jsonData.tlsAuth || jsonData.tlsAuthWithCACert ? (React.createElement(React.Fragment, null,
            React.createElement(Divider, null),
            React.createElement(ConfigSection, { title: "TLS/SSL Auth Details" }, jsonData.tlsAuth || jsonData.tlsAuthWithCACert ? (React.createElement(TLSSecretsConfig, { showCACert: jsonData.tlsAuthWithCACert, showKeyPair: jsonData.tlsAuth, editorProps: props, labelWidth: 25 })) : null))) : null,
        React.createElement(Divider, null),
        React.createElement(ConfigSection, { title: "Additional settings" },
            React.createElement(Field, { label: React.createElement(Label, null,
                    React.createElement(Stack, { gap: 0.5 },
                        React.createElement("span", null, "Session timezone"),
                        React.createElement(Tooltip, { content: React.createElement("span", null,
                                "Specify the time zone used in the database session, e.g. ",
                                React.createElement("code", null, "Europe/Berlin"),
                                " or",
                                React.createElement("code", null, "+02:00"),
                                ". This is necessary, if the timezone of the database (or the host of the database) is set to something other than UTC. The value is set in the session with",
                                React.createElement("code", null, "SET time_zone='...'"),
                                ". If you leave this field empty, the timezone is not updated. You can find more information in the MySQL documentation.") },
                            React.createElement(Icon, { name: "info-circle", size: "sm" })))) },
                React.createElement(Input, { width: WIDTH_LONG, value: jsonData.timezone || '', onChange: onUpdateDatasourceJsonDataOption(props, 'timezone'), placeholder: "Europe/Berlin or +02:00" })),
            React.createElement(Field, { label: React.createElement(Label, null,
                    React.createElement(Stack, { gap: 0.5 },
                        React.createElement("span", null, "Min time interval"),
                        React.createElement(Tooltip, { content: React.createElement("span", null,
                                "A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example",
                                React.createElement("code", null, "1m"),
                                " if your data is written every minute.") },
                            React.createElement(Icon, { name: "info-circle", size: "sm" })))), description: "A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example 1m if your data is written every minute." },
                React.createElement(Input, { width: WIDTH_LONG, placeholder: "1m", value: jsonData.timeInterval || '', onChange: onUpdateDatasourceJsonDataOption(props, 'timeInterval') }))),
        React.createElement(Divider, null),
        React.createElement(ConnectionLimits, { options: options, onOptionsChange: onOptionsChange }),
        React.createElement(Divider, null),
        React.createElement(Alert, { title: "User Permission", severity: "info" },
            "The database user should only be granted SELECT permissions on the specified database & tables you want to query. Grafana does not validate that queries are safe so queries can contain any SQL statement. For example, statements like ",
            React.createElement("code", null, "USE otherdb;"),
            " and ",
            React.createElement("code", null, "DROP TABLE user;"),
            " would be executed. To protect against this we ",
            React.createElement("strong", null, "Highly"),
            " recommend you create a specific MySQL user with restricted permissions. Check out the",
            ' ',
            React.createElement(Link, { rel: "noreferrer", target: "_blank", href: "http://docs.grafana.org/features/datasources/mysql/" }, "MySQL Data Source Docs"),
            ' ',
            "for more information.")));
};
//# sourceMappingURL=ConfigurationEditor.js.map