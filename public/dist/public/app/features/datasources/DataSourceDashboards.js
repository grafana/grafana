import { __awaiter, __extends, __generator } from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
// Components
import Page from 'app/core/components/Page/Page';
import DashboardTable from './DashboardsTable';
// Actions & Selectors
import { getNavModel } from 'app/core/selectors/navModel';
import { loadDataSource } from './state/actions';
import { loadPluginDashboards } from '../plugins/state/actions';
import { importDashboard, removeDashboard } from '../dashboard/state/actions';
import { getDataSource } from './state/selectors';
function mapStateToProps(state, props) {
    var dataSourceId = props.match.params.uid;
    return {
        navModel: getNavModel(state.navIndex, "datasource-dashboards-" + dataSourceId),
        dashboards: state.plugins.dashboards,
        dataSource: getDataSource(state.dataSources, dataSourceId),
        isLoading: state.plugins.isLoadingPluginDashboards,
        dataSourceId: dataSourceId,
    };
}
var mapDispatchToProps = {
    importDashboard: importDashboard,
    loadDataSource: loadDataSource,
    loadPluginDashboards: loadPluginDashboards,
    removeDashboard: removeDashboard,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var DataSourceDashboards = /** @class */ (function (_super) {
    __extends(DataSourceDashboards, _super);
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
        return __awaiter(this, void 0, void 0, function () {
            var _a, loadDataSource, dataSourceId;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.props, loadDataSource = _a.loadDataSource, dataSourceId = _a.dataSourceId;
                        return [4 /*yield*/, loadDataSource(dataSourceId)];
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
export default connector(DataSourceDashboards);
//# sourceMappingURL=DataSourceDashboards.js.map