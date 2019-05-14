import _ from 'lodash';
import coreModule from 'app/core/core_module';
var HistorySrv = /** @class */ (function () {
    /** @ngInject */
    function HistorySrv(backendSrv) {
        this.backendSrv = backendSrv;
    }
    HistorySrv.prototype.getHistoryList = function (dashboard, options) {
        var id = dashboard && dashboard.id ? dashboard.id : void 0;
        return id ? this.backendSrv.get("api/dashboards/id/" + id + "/versions", options) : Promise.resolve([]);
    };
    HistorySrv.prototype.calculateDiff = function (options) {
        return this.backendSrv.post('api/dashboards/calculate-diff', options);
    };
    HistorySrv.prototype.restoreDashboard = function (dashboard, version) {
        var id = dashboard && dashboard.id ? dashboard.id : void 0;
        var url = "api/dashboards/id/" + id + "/restore";
        return id && _.isNumber(version) ? this.backendSrv.post(url, { version: version }) : Promise.resolve({});
    };
    return HistorySrv;
}());
export { HistorySrv };
coreModule.service('historySrv', HistorySrv);
//# sourceMappingURL=HistorySrv.js.map