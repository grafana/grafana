import { __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { updateDatasourcePluginJsonDataOption, updateDatasourcePluginOption, updateDatasourcePluginResetOption, updateDatasourcePluginSecureJsonDataOption, } from '@grafana/data';
import { Alert } from '@grafana/ui';
import { MonitorConfig } from './MonitorConfig';
import { AnalyticsConfig } from './AnalyticsConfig';
import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import { InsightsConfig } from './InsightsConfig';
import ResponseParser from '../azure_monitor/response_parser';
import { isAppInsightsConfigured } from '../credentials';
import { routeNames } from '../utils/common';
var ConfigEditor = /** @class */ (function (_super) {
    __extends(ConfigEditor, _super);
    function ConfigEditor(props) {
        var _this = _super.call(this, props) || this;
        _this.templateSrv = getTemplateSrv();
        _this.updateOptions = function (optionsFunc) {
            var updated = optionsFunc(_this.props.options);
            _this.props.onOptionsChange(updated);
            _this.setState({ unsaved: true });
        };
        _this.saveOptions = function () { return __awaiter(_this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.state.unsaved) return [3 /*break*/, 2];
                        return [4 /*yield*/, getBackendSrv()
                                .put("/api/datasources/" + this.props.options.id, this.props.options)
                                .then(function (result) {
                                updateDatasourcePluginOption(_this.props, 'version', result.datasource.version);
                            })];
                    case 1:
                        _a.sent();
                        this.setState({ unsaved: false });
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        }); };
        _this.getSubscriptions = function () { return __awaiter(_this, void 0, void 0, function () {
            var query, result, err_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.saveOptions()];
                    case 1:
                        _b.sent();
                        query = "?api-version=2019-03-01";
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, getBackendSrv()
                                .fetch({
                                url: this.baseURL + query,
                                method: 'GET',
                            })
                                .toPromise()];
                    case 3:
                        result = _b.sent();
                        this.setState({ error: undefined });
                        return [2 /*return*/, ResponseParser.parseSubscriptionsForSelect(result)];
                    case 4:
                        err_1 = _b.sent();
                        this.setState({
                            error: {
                                title: 'Error requesting subscriptions',
                                description: 'Could not request subscriptions from Azure. Check your credentials and try again.',
                                details: (_a = err_1 === null || err_1 === void 0 ? void 0 : err_1.data) === null || _a === void 0 ? void 0 : _a.message,
                            },
                        });
                        return [2 /*return*/, Promise.resolve([])];
                    case 5: return [2 /*return*/];
                }
            });
        }); };
        // TODO: Used only by InsightsConfig
        _this.onUpdateJsonDataOption = function (key) { return function (event) {
            updateDatasourcePluginJsonDataOption(_this.props, key, event.currentTarget.value);
        }; };
        // TODO: Used only by InsightsConfig
        _this.onUpdateSecureJsonDataOption = function (key) { return function (event) {
            updateDatasourcePluginSecureJsonDataOption(_this.props, key, event.currentTarget.value);
        }; };
        // TODO: Used only by InsightsConfig
        _this.resetSecureKey = function (key) {
            updateDatasourcePluginResetOption(_this.props, key);
        };
        _this.state = {
            unsaved: false,
            appInsightsInitiallyConfigured: isAppInsightsConfigured(props.options),
        };
        _this.baseURL = "/api/datasources/" + _this.props.options.id + "/resources/" + routeNames.azureMonitor + "/subscriptions";
        return _this;
    }
    ConfigEditor.prototype.render = function () {
        var options = this.props.options;
        var error = this.state.error;
        return (React.createElement(React.Fragment, null,
            React.createElement(MonitorConfig, { options: options, updateOptions: this.updateOptions, getSubscriptions: this.getSubscriptions }),
            React.createElement(AnalyticsConfig, { options: options, updateOptions: this.updateOptions }),
            this.state.appInsightsInitiallyConfigured && (React.createElement(InsightsConfig, { options: options, onUpdateJsonDataOption: this.onUpdateJsonDataOption, onUpdateSecureJsonDataOption: this.onUpdateSecureJsonDataOption, onResetOptionKey: this.resetSecureKey })),
            error && (React.createElement(Alert, { severity: "error", title: error.title },
                React.createElement("p", null, error.description),
                error.details && React.createElement("details", { style: { whiteSpace: 'pre-wrap' } }, error.details)))));
    };
    return ConfigEditor;
}(PureComponent));
export { ConfigEditor };
export default ConfigEditor;
//# sourceMappingURL=ConfigEditor.js.map