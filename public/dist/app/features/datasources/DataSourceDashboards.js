import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
// Components
import Page from 'app/core/components/Page/Page';
import DashboardTable from './DashboardsTable';
// Actions & Selectors
import { getNavModel } from 'app/core/selectors/navModel';
import { getRouteParamsId } from 'app/core/selectors/location';
import { loadDataSource } from './state/actions';
import { loadPluginDashboards } from '../plugins/state/actions';
import { importDashboard, removeDashboard } from '../dashboard/state/actions';
import { getDataSource } from './state/selectors';
var DataSourceDashboards = /** @class */ (function (_super) {
    tslib_1.__extends(DataSourceDashboards, _super);
    function DataSourceDashboards() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onImport = function (dashboard, overwrite) {
            var _a = _this.props, dataSource = _a.dataSource, importDashboard = _a.importDashboard;
            var data = {
                pluginId: dashboard.pluginId,
                path: dashboard.path,
                overwrite: overwrite,
                inputs: [],
            };
            if (dataSource) {
                data.inputs.push({
                    name: '*',
                    type: 'datasource',
                    pluginId: dataSource.type,
                    value: dataSource.name,
                });
            }
            importDashboard(data, dashboard.title);
        };
        _this.onRemove = function (dashboard) {
            _this.props.removeDashboard(dashboard.importedUri);
        };
        return _this;
    }
    DataSourceDashboards.prototype.componentDidMount = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _a, loadDataSource, pageId;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.props, loadDataSource = _a.loadDataSource, pageId = _a.pageId;
                        return [4 /*yield*/, loadDataSource(pageId)];
                    case 1:
                        _b.sent();
                        this.props.loadPluginDashboards();
                        return [2 /*return*/];
                }
            });
        });
    };
    DataSourceDashboards.prototype.render = function () {
        var _this = this;
        var _a = this.props, dashboards = _a.dashboards, navModel = _a.navModel, isLoading = _a.isLoading;
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: isLoading },
                React.createElement(DashboardTable, { dashboards: dashboards, onImport: function (dashboard, overwrite) { return _this.onImport(dashboard, overwrite); }, onRemove: function (dashboard) { return _this.onRemove(dashboard); } }))));
    };
    return DataSourceDashboards;
}(PureComponent));
export { DataSourceDashboards };
function mapStateToProps(state) {
    var pageId = getRouteParamsId(state.location);
    return {
        navModel: getNavModel(state.navIndex, "datasource-dashboards-" + pageId),
        pageId: pageId,
        dashboards: state.plugins.dashboards,
        dataSource: getDataSource(state.dataSources, pageId),
        isLoading: state.plugins.isLoadingPluginDashboards,
    };
}
var mapDispatchToProps = {
    importDashboard: importDashboard,
    loadDataSource: loadDataSource,
    loadPluginDashboards: loadPluginDashboards,
    removeDashboard: removeDashboard,
};
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(DataSourceDashboards));
//# sourceMappingURL=DataSourceDashboards.js.map