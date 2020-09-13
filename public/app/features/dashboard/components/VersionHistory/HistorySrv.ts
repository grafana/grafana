import _ from 'lodash';
import coreModule from 'app/core/core_module';
import { DashboardModel } from '../../state/DashboardModel';
import { getBackendSrv } from '@grafana/runtime';

export interface HistoryListOpts {
  limit: number;
  start: number;
}

export interface RevisionsModel {
  id: number;
  checked: boolean;
  dashboardId: number;
  parentVersion: number;
  version: number;
  created: Date;
  createdBy: string;
  message: string;
}

export interface CalculateDiffOptions {
  new: DiffTarget;
  base: DiffTarget;
  diffType: string;
}

export interface DiffTarget {
  dashboardId: number;
  version: number;
  unsavedDashboard?: DashboardModel; // when doing diffs against unsaved dashboard version
}

export class HistorySrv {
  getHistoryList(dashboard: DashboardModel, options: HistoryListOpts) {
    const id = dashboard && dashboard.id ? dashboard.id : void 0;
    return id ? getBackendSrv().get(`api/dashboards/id/${id}/versions`, options) : Promise.resolve([]);
  }

  calculateDiff(options: CalculateDiffOptions) {
    return getBackendSrv().post('api/dashboards/calculate-diff', options);
  }

  restoreDashboard(dashboard: DashboardModel, version: number) {
    const id = dashboard && dashboard.id ? dashboard.id : void 0;
    const url = `api/dashboards/id/${id}/restore`;

    return id && _.isNumber(version) ? getBackendSrv().post(url, { version }) : Promise.resolve({});
  }
}

coreModule.service('historySrv', HistorySrv);
