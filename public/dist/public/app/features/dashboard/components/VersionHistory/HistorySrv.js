import { isNumber } from 'lodash';
import { getBackendSrv } from '@grafana/runtime';
export class HistorySrv {
    getHistoryList(dashboard, options) {
        const uid = dashboard && dashboard.uid ? dashboard.uid : void 0;
        return uid ? getBackendSrv().get(`api/dashboards/uid/${uid}/versions`, options) : Promise.resolve([]);
    }
    getDashboardVersion(uid, version) {
        return getBackendSrv().get(`api/dashboards/uid/${uid}/versions/${version}`);
    }
    restoreDashboard(dashboard, version) {
        const uid = dashboard && dashboard.uid ? dashboard.uid : void 0;
        const url = `api/dashboards/uid/${uid}/restore`;
        return uid && isNumber(version) ? getBackendSrv().post(url, { version }) : Promise.resolve({});
    }
}
const historySrv = new HistorySrv();
export { historySrv };
//# sourceMappingURL=HistorySrv.js.map