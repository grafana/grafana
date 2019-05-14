import store from 'app/core/store';
import _ from 'lodash';
import config from 'app/core/config';
var ImpressionSrv = /** @class */ (function () {
    function ImpressionSrv() {
    }
    ImpressionSrv.prototype.addDashboardImpression = function (dashboardId) {
        var impressionsKey = this.impressionKey(config);
        var impressions = [];
        if (store.exists(impressionsKey)) {
            impressions = JSON.parse(store.get(impressionsKey));
            if (!_.isArray(impressions)) {
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
        var impressions = store.get(this.impressionKey(config)) || '[]';
        impressions = JSON.parse(impressions);
        impressions = _.filter(impressions, function (el) {
            return _.isNumber(el);
        });
        return impressions;
    };
    ImpressionSrv.prototype.impressionKey = function (config) {
        return 'dashboard_impressions-' + config.bootData.user.orgId;
    };
    return ImpressionSrv;
}());
export { ImpressionSrv };
var impressionSrv = new ImpressionSrv();
export default impressionSrv;
//# sourceMappingURL=impression_srv.js.map