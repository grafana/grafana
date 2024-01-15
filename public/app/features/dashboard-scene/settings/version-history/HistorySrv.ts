import { isNumber } from 'lodash';

import { getBackendSrv } from '@grafana/runtime';
import { DashboardModel } from 'app/features/dashboard/state';

export interface HistoryListOpts {
  limit: number;
  start: number;
}

export interface RevisionsModel {
  id: number;
  checked: boolean;
  dashboardUID: string;
  parentVersion: number;
  version: number;
  created: Date;
  createdBy: string;
  message: string;
}

export interface DiffTarget {
  dashboardUID: string;
  version: number;
  unsavedDashboard?: DashboardModel; // when doing diffs against unsaved dashboard version
}

export class HistorySrv {
  getHistoryList(dashboardUID: string, options: HistoryListOpts) {
    if (typeof dashboardUID !== 'string') {
      return Promise.resolve([]);
    }

    return getBackendSrv().get(`api/dashboards/uid/${dashboardUID}/versions`, options);
  }

  getDashboardVersion(uid: string, version: number) {
    return getBackendSrv().get(`api/dashboards/uid/${uid}/versions/${version}`);
  }

  restoreDashboard(dashboard: DashboardModel, version: number) {
    const uid = dashboard && dashboard.uid ? dashboard.uid : void 0;
    const url = `api/dashboards/uid/${uid}/restore`;

    return uid && isNumber(version) ? getBackendSrv().post(url, { version }) : Promise.resolve({});
  }
}

const historySrv = new HistorySrv();
export { historySrv };
