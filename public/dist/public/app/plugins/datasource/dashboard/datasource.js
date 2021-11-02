import { __extends } from "tslib";
import { DataSourceApi } from '@grafana/data';
/**
 * This should not really be called
 */
var DashboardDatasource = /** @class */ (function (_super) {
    __extends(DashboardDatasource, _super);
    function DashboardDatasource(instanceSettings) {
        return _super.call(this, instanceSettings) || this;
    }
    DashboardDatasource.prototype.getCollapsedText = function (query) {
        return "Dashboard Reference: " + query.panelId;
    };
    DashboardDatasource.prototype.query = function (options) {
        return Promise.reject('This should not be called directly');
    };
    DashboardDatasource.prototype.testDatasource = function () {
        return Promise.resolve({});
    };
    return DashboardDatasource;
}(DataSourceApi));
export { DashboardDatasource };
//# sourceMappingURL=datasource.js.map