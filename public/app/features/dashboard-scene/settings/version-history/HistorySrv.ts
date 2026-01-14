import { getBackendSrv } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';

export interface HistoryListOpts {
  limit: number;
  start: number;
  continueToken?: string;
}

export interface RevisionsModel {
  id: number;
  checked: boolean;
  uid: string;
  parentVersion: number;
  version: number;
  created: Date;
  createdBy: string;
  message: string;
  data: Dashboard;
}

// TODO: this should be removed entirely
export class HistorySrv {
  getHistoryList(dashboardUID: string, options: HistoryListOpts) {
    if (typeof dashboardUID !== 'string') {
      return Promise.resolve([]);
    }

    return getBackendSrv().get(`api/dashboards/uid/${dashboardUID}/versions`, options);
  }

  getDashboardVersion(dashboardUID: string, version: number) {
    if (typeof dashboardUID !== 'string') {
      return Promise.resolve({});
    }

    return getBackendSrv().get(`api/dashboards/uid/${dashboardUID}/versions/${version}`);
  }
}

const historySrv = new HistorySrv();
export { historySrv };
