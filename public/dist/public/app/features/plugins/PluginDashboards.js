import { __awaiter, __extends, __generator, __read, __spreadArray } from "tslib";
import React, { PureComponent } from 'react';
import { extend } from 'lodash';
import { getBackendSrv } from '@grafana/runtime';
import { appEvents } from 'app/core/core';
import DashboardsTable from 'app/features/datasources/DashboardsTable';
import { AppEvents } from '@grafana/data';
var PluginDashboards = /** @class */ (function (_super) {
    __extends(PluginDashboards, _super);
    function PluginDashboards(props) {
        var _this = _super.call(this, props) || this;
        _this.importAll = function () {
            _this.importNext(0);
        };
        _this.importNext = function (index) {
            var dashboards = _this.state.dashboards;
            return _this.import(dashboards[index], true).then(function () {
                if (index + 1 < dashboards.length) {
                    return new Promise(function (resolve) {
                        setTimeout(function () {
                            _this.importNext(index + 1).then(function () {
                                resolve();
                            });
                        }, 500);
                    });
                }
                else {
                    return Promise.resolve();
                }
            });
        };
        _this.import = function (dash, overwrite) {
            var _a = _this.props, plugin = _a.plugin, datasource = _a.datasource;
            var installCmd = {
                pluginId: plugin.id,
                path: dash.path,
                overwrite: overwrite,
                inputs: [],
            };
            if (datasource) {
                installCmd.inputs.push({
                    name: '*',
                    type: 'datasource',
                    pluginId: datasource.meta.id,
                    value: datasource.name,
                });
            }
            return getBackendSrv()
                .post("/api/dashboards/import", installCmd)
                .then(function (res) {
                appEvents.emit(AppEvents.alertSuccess, ['Dashboard Imported', dash.title]);
                extend(dash, res);
                _this.setState({ dashboards: __spreadArray([], __read(_this.state.dashboards), false) });
            });
        };
        _this.remove = function (dash) {
            getBackendSrv()
                .delete('/api/dashboards/' + dash.importedUri)
                .then(function () {
                dash.imported = false;
                _this.setState({ dashboards: __spreadArray([], __read(_this.state.dashboards), false) });
            });
        };
        _this.state = {
            loading: true,
            dashboards: [],
        };
        return _this;
    }
    PluginDashboards.prototype.componentDidMount = function () {
        return __awaiter(this, void 0, void 0, function () {
            var pluginId;
            var _this = this;
            return __generator(this, function (_a) {
                pluginId = this.props.plugin.id;
                getBackendSrv()
                    .get("/api/plugins/" + pluginId + "/dashboards")
                    .then(function (dashboards) {
                    _this.setState({ dashboards: dashboards, loading: false });
                });
                return [2 /*return*/];
            });
        });
    };
    PluginDashboards.prototype.render = function () {
        var _a = this.state, loading = _a.loading, dashboards = _a.dashboards;
        if (loading) {
            return React.createElement("div", null, "loading...");
        }
        if (!dashboards || !dashboards.length) {
            return React.createElement("div", null, "No dashboards are included with this plugin");
        }
        return (React.createElement("div", { className: "gf-form-group" },
            React.createElement(DashboardsTable, { dashboards: dashboards, onImport: this.import, onRemove: this.remove })));
    };
    return PluginDashboards;
}(PureComponent));
export { PluginDashboards };
//# sourceMappingURL=PluginDashboards.js.map