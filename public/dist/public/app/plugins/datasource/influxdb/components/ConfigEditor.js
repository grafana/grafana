import { __assign, __extends } from "tslib";
import React, { PureComponent } from 'react';
import { onUpdateDatasourceOption, updateDatasourcePluginResetOption, onUpdateDatasourceJsonDataOption, onUpdateDatasourceJsonDataOptionSelect, onUpdateDatasourceSecureJsonDataOption, updateDatasourcePluginJsonDataOption, } from '@grafana/data';
import { Alert, DataSourceHttpSettings, InfoBox, InlineField, InlineFormLabel, LegacyForms } from '@grafana/ui';
var Select = LegacyForms.Select, Input = LegacyForms.Input, SecretFormField = LegacyForms.SecretFormField;
import { InfluxVersion } from '../types';
var httpModes = [
    { label: 'GET', value: 'GET' },
    { label: 'POST', value: 'POST' },
];
var versions = [
    {
        label: 'InfluxQL',
        value: InfluxVersion.InfluxQL,
        description: 'The InfluxDB SQL-like query language.  Supported in InfluxDB 1.x',
    },
    {
        label: 'Flux',
        value: InfluxVersion.Flux,
        description: 'Advanced data scripting and query language.  Supported in InfluxDB 2.x and 1.8+ (beta)',
    },
];
var ConfigEditor = /** @class */ (function (_super) {
    __extends(ConfigEditor, _super);
    function ConfigEditor(props) {
        var _a;
        var _this = _super.call(this, props) || this;
        _this.state = {
            maxSeries: '',
        };
        // 1x
        _this.onResetPassword = function () {
            updateDatasourcePluginResetOption(_this.props, 'password');
        };
        // 2x
        _this.onResetToken = function () {
            updateDatasourcePluginResetOption(_this.props, 'token');
        };
        _this.onVersionChanged = function (selected) {
            var _a = _this.props, options = _a.options, onOptionsChange = _a.onOptionsChange;
            var copy = __assign(__assign({}, options), { jsonData: __assign(__assign({}, options.jsonData), { version: selected.value }) });
            if (selected.value === InfluxVersion.Flux) {
                copy.access = 'proxy';
                copy.basicAuth = true;
                copy.jsonData.httpMode = 'POST';
                // Remove old 1x configs
                delete copy.user;
                delete copy.database;
            }
            onOptionsChange(copy);
        };
        _this.state.maxSeries = ((_a = props.options.jsonData.maxSeries) === null || _a === void 0 ? void 0 : _a.toString()) || '';
        return _this;
    }
    ConfigEditor.prototype.renderInflux2x = function () {
        var options = this.props.options;
        var secureJsonFields = options.secureJsonFields;
        var secureJsonData = (options.secureJsonData || {});
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { className: "width-10" }, "Organization"),
                    React.createElement("div", { className: "width-10" },
                        React.createElement(Input, { className: "width-20", value: options.jsonData.organization || '', onChange: onUpdateDatasourceJsonDataOption(this.props, 'organization') })))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(SecretFormField, { isConfigured: (secureJsonFields && secureJsonFields.token), value: secureJsonData.token || '', label: "Token", labelWidth: 10, inputWidth: 20, onReset: this.onResetToken, onChange: onUpdateDatasourceSecureJsonDataOption(this.props, 'token') }))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { className: "width-10" }, "Default Bucket"),
                    React.createElement("div", { className: "width-10" },
                        React.createElement(Input, { className: "width-20", placeholder: "default bucket", value: options.jsonData.defaultBucket || '', onChange: onUpdateDatasourceJsonDataOption(this.props, 'defaultBucket') })))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { className: "width-10", tooltip: "A lower limit for the auto group by time interval. Recommended to be set to write frequency,\n\t\t\t\tfor example 1m if your data is written every minute." }, "Min time interval"),
                    React.createElement("div", { className: "width-10" },
                        React.createElement(Input, { className: "width-10", placeholder: "10s", value: options.jsonData.timeInterval || '', onChange: onUpdateDatasourceJsonDataOption(this.props, 'timeInterval') }))))));
    };
    ConfigEditor.prototype.renderInflux1x = function () {
        var options = this.props.options;
        var secureJsonFields = options.secureJsonFields;
        var secureJsonData = (options.secureJsonData || {});
        return (React.createElement(React.Fragment, null,
            React.createElement(InfoBox, null,
                React.createElement("h5", null, "Database Access"),
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
                    React.createElement(InlineFormLabel, { className: "width-10" }, "Database"),
                    React.createElement("div", { className: "width-20" },
                        React.createElement(Input, { className: "width-20", value: options.database || '', onChange: onUpdateDatasourceOption(this.props, 'database') })))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { className: "width-10" }, "User"),
                    React.createElement("div", { className: "width-10" },
                        React.createElement(Input, { className: "width-20", value: options.user || '', onChange: onUpdateDatasourceOption(this.props, 'user') })))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(SecretFormField, { isConfigured: (secureJsonFields && secureJsonFields.password), value: secureJsonData.password || '', label: "Password", labelWidth: 10, inputWidth: 20, onReset: this.onResetPassword, onChange: onUpdateDatasourceSecureJsonDataOption(this.props, 'password') }))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { className: "width-10", tooltip: "You can use either GET or POST HTTP method to query your InfluxDB database. The POST\n          method allows you to perform heavy requests (with a lots of WHERE clause) while the GET method\n          will restrict you and return an error if the query is too large." }, "HTTP Method"),
                    React.createElement(Select, { menuShouldPortal: true, className: "width-10", value: httpModes.find(function (httpMode) { return httpMode.value === options.jsonData.httpMode; }), options: httpModes, defaultValue: options.jsonData.httpMode, onChange: onUpdateDatasourceJsonDataOptionSelect(this.props, 'httpMode') }))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { className: "width-10", tooltip: "A lower limit for the auto group by time interval. Recommended to be set to write frequency,\n\t\t\t\tfor example 1m if your data is written every minute." }, "Min time interval"),
                    React.createElement("div", { className: "width-10" },
                        React.createElement(Input, { className: "width-10", placeholder: "10s", value: options.jsonData.timeInterval || '', onChange: onUpdateDatasourceJsonDataOption(this.props, 'timeInterval') }))))));
    };
    ConfigEditor.prototype.render = function () {
        var _this = this;
        var _a = this.props, options = _a.options, onOptionsChange = _a.onOptionsChange;
        return (React.createElement(React.Fragment, null,
            React.createElement("h3", { className: "page-heading" }, "Query Language"),
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("div", { className: "gf-form-inline" },
                    React.createElement("div", { className: "gf-form" },
                        React.createElement(Select, { menuShouldPortal: true, className: "width-30", value: options.jsonData.version === InfluxVersion.Flux ? versions[1] : versions[0], options: versions, defaultValue: versions[0], onChange: this.onVersionChanged })))),
            options.jsonData.version === InfluxVersion.Flux && (React.createElement(InfoBox, null,
                React.createElement("h5", null, "Support for Flux in Grafana is currently in beta"),
                React.createElement("p", null,
                    "Please report any issues to: ",
                    React.createElement("br", null),
                    React.createElement("a", { href: "https://github.com/grafana/grafana/issues/new/choose" }, "https://github.com/grafana/grafana/issues")))),
            options.access === 'direct' && (React.createElement(Alert, { title: "Deprecation Notice", severity: "warning" }, "Browser access mode in the InfluxDB datasource is deprecated and will be removed in a future release.")),
            React.createElement(DataSourceHttpSettings, { showAccessOptions: true, dataSourceConfig: options, defaultUrl: "http://localhost:8086", onChange: onOptionsChange }),
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("div", null,
                    React.createElement("h3", { className: "page-heading" }, "InfluxDB Details")),
                options.jsonData.version === InfluxVersion.Flux ? this.renderInflux2x() : this.renderInflux1x(),
                React.createElement("div", { className: "gf-form-inline" },
                    React.createElement(InlineField, { labelWidth: 20, label: "Max series", tooltip: "Limit the number of series/tables that Grafana will process. Lower this number to prevent abuse, and increase it if you have lots of small time series and not all are shown. Defaults to 1000." },
                        React.createElement(Input, { placeholder: "1000", type: "number", className: "width-10", value: this.state.maxSeries, onChange: function (event) {
                                // We duplicate this state so that we allow to write freely inside the input. We don't have
                                // any influence over saving so this seems to be only way to do this.
                                _this.setState({ maxSeries: event.currentTarget.value });
                                var val = parseInt(event.currentTarget.value, 10);
                                updateDatasourcePluginJsonDataOption(_this.props, 'maxSeries', Number.isFinite(val) ? val : undefined);
                            } }))))));
    };
    return ConfigEditor;
}(PureComponent));
export { ConfigEditor };
export default ConfigEditor;
//# sourceMappingURL=ConfigEditor.js.map