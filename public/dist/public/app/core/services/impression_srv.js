import store from 'app/core/store';
import { filter, isArray, isNumber } from 'lodash';
import config from 'app/core/config';
var ImpressionSrv = /** @class */ (function () {
    function ImpressionSrv() {
    }
    ImpressionSrv.prototype.addDashboardImpression = function (dashboardId) {
        var impressionsKey = this.impressionKey();
        var impressions = [];
        if (store.exists(impressionsKey)) {
            impressions = JSON.parse(store.get(impressionsKey));
            if (!isArray(impressions)) {
                impressions = [];
            }
        }
        impressions = impressions.filter(function (imp) {
            return dashboardId !== imp;
        });
        impressions.unshift(dashboardId);
        if (impressions.length > 50) {
            impressions.pop();
        }
        store.set(impressionsKey, JSON.stringify(impressions));
    };
    ImpressionSrv.prototype.getDashboardOpened = function () {
        var impressions = store.get(this.impressionKey()) || '[]';
        impressions = JSON.parse(impressions);
        impressions = filter(impressions, function (el) {
            return isNumber(el);
        });
        return impressions;
    };
    ImpressionSrv.prototype.impressionKey = function () {
        return 'dashboard_impressions-' + config.bootData.user.orgId;
    };
    return ImpressionSrv;
}());
export { ImpressionSrv };
var impressionSrv = new ImpressionSrv();
export default impressionSrv;
//# sourceMappingURL=impression_srv.js.map