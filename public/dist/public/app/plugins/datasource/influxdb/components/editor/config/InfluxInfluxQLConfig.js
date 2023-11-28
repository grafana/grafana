import { uniqueId } from 'lodash';
import React from 'react';
import { onUpdateDatasourceJsonDataOption, onUpdateDatasourceJsonDataOptionSelect, onUpdateDatasourceOption, onUpdateDatasourceSecureJsonDataOption, updateDatasourcePluginResetOption, } from '@grafana/data';
import { Alert, InlineFormLabel, LegacyForms, Select } from '@grafana/ui';
const { Input, SecretFormField } = LegacyForms;
const httpModes = [
    { label: 'GET', value: 'GET' },
    { label: 'POST', value: 'POST' },
];
export const InfluxInfluxQLConfig = (props) => {
    var _a;
    const { options, onOptionsChange } = props;
    const { database, jsonData, secureJsonData, secureJsonFields } = options;
    const htmlPrefix = uniqueId('influxdb-influxql-config');
    return (React.createElement(React.Fragment, null,
        React.createElement(Alert, { severity: "info", title: "Database Access" },
            React.createElement("p", null,
                "Setting the database for this datasource does not deny access to other databases. The InfluxDB query syntax allows switching the database in the query. For example:",
                React.createElement("code", null, "SHOW MEASUREMENTS ON _internal"),
                " or",
                React.createElement("code", null, "SELECT * FROM \"_internal\"..\"database\" LIMIT 10"),
                React.createElement("br", null),
                React.createElement("br", null),
                "To support data isolation and security, make sure appropriate permissions are configured in InfluxDB.")),
        React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form" },
                React.createElement(InlineFormLabel, { htmlFor: `${htmlPrefix}-db`, className: "width-10" }, "Database"),
                React.createElement("div", { className: "width-20" },
                    React.createElement(Input, { id: `${htmlPrefix}-db`, className: "width-20", value: (_a = jsonData.dbName) !== null && _a !== void 0 ? _a : database, onChange: (event) => {
                            onOptionsChange(Object.assign(Object.assign({}, options), { database: '', jsonData: Object.assign(Object.assign({}, jsonData), { dbName: event.target.value }) }));
                        } })))),
        React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form" },
                React.createElement(InlineFormLabel, { htmlFor: `${htmlPrefix}-user`, className: "width-10" }, "User"),
                React.createElement("div", { className: "width-10" },
                    React.createElement(Input, { id: `${htmlPrefix}-user`, className: "width-20", value: options.user || '', onChange: onUpdateDatasourceOption(props, 'user') })))),
        React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form" },
                React.createElement(SecretFormField, { isConfigured: Boolean(secureJsonFields && secureJsonFields.password), value: (secureJsonData === null || secureJsonData === void 0 ? void 0 : secureJsonData.password) || '', label: "Password", "aria-label": "Password", labelWidth: 10, inputWidth: 20, onReset: () => updateDatasourcePluginResetOption(props, 'password'), onChange: onUpdateDatasourceSecureJsonDataOption(props, 'password') }))),
        React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form" },
                React.createElement(InlineFormLabel, { htmlFor: `${htmlPrefix}-http-method`, className: "width-10", tooltip: "You can use either GET or POST HTTP method to query your InfluxDB database. The POST\n          method allows you to perform heavy requests (with a lots of WHERE clause) while the GET method\n          will restrict you and return an error if the query is too large." }, "HTTP Method"),
                React.createElement(Select, { inputId: `${htmlPrefix}-http-method`, className: "width-20", value: httpModes.find((httpMode) => httpMode.value === options.jsonData.httpMode), options: httpModes, defaultValue: options.jsonData.httpMode, onChange: onUpdateDatasourceJsonDataOptionSelect(props, 'httpMode') }))),
        React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form" },
                React.createElement(InlineFormLabel, { className: "width-10", tooltip: "A lower limit for the auto group by time interval. Recommended to be set to write frequency,\n\t\t\t\tfor example 1m if your data is written every minute." }, "Min time interval"),
                React.createElement("div", { className: "width-10" },
                    React.createElement(Input, { className: "width-20", placeholder: "10s", value: options.jsonData.timeInterval || '', onChange: onUpdateDatasourceJsonDataOption(props, 'timeInterval') }))))));
};
//# sourceMappingURL=InfluxInfluxQLConfig.js.map