import { getBackendSrv } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { SaveDashboardResponseDTO } from 'app/types';

export interface HistoryListOpts {
  limit: number;
  start: number;
}

// The raw version from 
export interface VersionModel {
  uid: string;
  version: number | string; // resourceVersion in k8s
  created: string;
  createdBy: string;
  message: string;
}

export interface HistorySrv {
  getHistoryList(dashboardUID: string, options: HistoryListOpts): Promise<VersionModel[]>;
  getDashboardVersion(dashboardUID: string, version: number | string): Promise<Dashboard>; // Just the spec (for now)
  restoreDashboard(dashboardUID: string, version: number | string): Promise<SaveDashboardResponseDTO>;
}

class LegacyHistorySrv implements HistorySrv {
  getHistoryList(dashboardUID: string, options: HistoryListOpts) {
    if (typeof dashboardUID !== 'string') {
      return Promise.resolve([]);
    }

    return getBackendSrv().get<VersionModel[]>(`api/dashboards/uid/${dashboardUID}/versions`, options);
  }

  async getDashboardVersion(dashboardUID: string, version: number): Promise<Dashboard> {
    if (typeof dashboardUID !== 'string') {
      return Promise.reject('invalid uid')
    }

    const info = await getBackendSrv().get(`api/dashboards/uid/${dashboardUID}/versions/${version}`);
    return info.data; // the dashboard body
  }

  restoreDashboard(dashboardUID: string, version: number): Promise<SaveDashboardResponseDTO> {
    if (typeof dashboardUID !== 'string') {
      return Promise.reject('invalid uid')
    }

    const url = `api/dashboards/uid/${dashboardUID}/restore`;

    return getBackendSrv().post(url, { version });
  }
}


let historySrv: HistorySrv|undefined = undefined;

export function getHistorySrv(): HistorySrv {
  if (!historySrv) {
    historySrv = new LegacyHistorySrv()
  }
  return historySrv
}
