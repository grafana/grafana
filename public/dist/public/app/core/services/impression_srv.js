import { __awaiter } from "tslib";
import { filter, isArray, isNumber, isString } from 'lodash';
import { getBackendSrv } from '@grafana/runtime';
import config from 'app/core/config';
import store from 'app/core/store';
export class ImpressionSrv {
    constructor() { }
    addDashboardImpression(dashboardUID) {
        const impressionsKey = this.impressionKey();
        let impressions = [];
        if (store.exists(impressionsKey)) {
            impressions = JSON.parse(store.get(impressionsKey));
            if (!isArray(impressions)) {
                impressions = [];
            }
        }
        impressions = impressions.filter((imp) => {
            return dashboardUID !== imp;
        });
        impressions.unshift(dashboardUID);
        if (impressions.length > 50) {
            impressions.pop();
        }
        store.set(impressionsKey, JSON.stringify(impressions));
    }
    convertToUIDs() {
        return __awaiter(this, void 0, void 0, function* () {
            let impressions = this.getImpressions();
            const ids = filter(impressions, (el) => isNumber(el));
            if (!ids.length) {
                return;
            }
            const convertedUIDs = yield getBackendSrv().get(`/api/dashboards/ids/${ids.join(',')}`);
            store.set(this.impressionKey(), JSON.stringify([...filter(impressions, (el) => isString(el)), ...convertedUIDs]));
        });
    }
    getImpressions() {
        const impressions = store.get(this.impressionKey()) || '[]';
        return JSON.parse(impressions);
    }
    /** Returns an array of internal (string) dashboard UIDs */
    getDashboardOpened() {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO should be removed after UID migration
            try {
                yield this.convertToUIDs();
            }
            catch (_) { }
            const result = filter(this.getImpressions(), (el) => isString(el));
            return result;
        });
    }
    impressionKey() {
        return 'dashboard_impressions-' + config.bootData.user.orgId;
    }
}
const impressionSrv = new ImpressionSrv();
export default impressionSrv;
//# sourceMappingURL=impression_srv.js.map