import { DataQuery, DataSourceRef } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardModel } from 'app/features/dashboard/state';
import { FormDTO, isSaveToNewDashboardDTO } from './types';

interface SaveOptions {
  queries: DataQuery[];
  panel: string;
  datasource: DataSourceRef;
}

const createDashboard = (
  dashboardName: string,
  folderId: number,
  queries: DataQuery[],
  datasource: DataSourceRef,
  panel: string
) => {
  const dashboard = getDashboardSrv().create({ title: dashboardName }, { folderId });

  dashboard.addPanel({ targets: queries, type: panel, title: 'New Panel', datasource });

  return getDashboardSrv().saveDashboard({ dashboard, folderId }, { showErrorAlert: false, showSuccessAlert: false });
};

const addPanelToDashboard = async (uid: string, queries: DataQuery[], datasource: DataSourceRef, panel: string) => {
  const dashboardData = await backendSrv.getDashboardByUid(uid);

  const dashboard = new DashboardModel(dashboardData.dashboard, dashboardData.meta);

  dashboard.addPanel({ targets: queries, type: panel, title: 'New Panel', datasource });

  return getDashboardSrv().saveDashboard({ dashboard }, { showErrorAlert: false, showSuccessAlert: false });
};

export const addToDashboard = async (data: FormDTO, options: SaveOptions): Promise<{ name: string; url: string }> => {
  let res, name;
  if (isSaveToNewDashboardDTO(data)) {
    name = data.dashboardName;
    res = await createDashboard(data.dashboardName, data.folderId, options.queries, options.datasource, options.panel);
  } else {
    name = data.dashboard.title;
    res = await addPanelToDashboard(data.dashboard.uid, options.queries, options.datasource, options.panel);
  }

  return { name, url: res.data.url };
};
