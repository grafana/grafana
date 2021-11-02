import { isNumber } from 'lodash';
import coreModule from 'app/core/core_module';
import { getBackendSrv } from '@grafana/runtime';
var HistorySrv = /** @class */ (function () {
    function HistorySrv() {
    }
    HistorySrv.prototype.getHistoryList = function (dashboard, options) {
        var id = dashboard && dashboard.id ? dashboard.id : void 0;
        return id ? getBackendSrv().get("api/dashboards/id/" + id + "/versions", options) : Promise.resolve([]);
    };
    HistorySrv.prototype.getDashboardVersion = function (id, version) {
        return getBackendSrv().get("api/dashboards/id/" + id + "/versions/" + version);
    };
    HistorySrv.prototype.restoreDashboard = function (dashboard, version) {
        var id = dashboard && dashboard.id ? dashboard.id : void 0;
        var url = "api/dashboards/id/" + id + "/restore";
        return id && isNumber(version) ? getBackendSrv().post(url, { version: version }) : Promise.resolve({});
    };
    return HistorySrv;
}());
export { HistorySrv };
var historySrv = new HistorySrv();
export { historySrv };
coreModule.service('historySrv', HistorySrv);
//# sourceMappingURL=HistorySrv.js.map