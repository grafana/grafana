import { DataQuery } from '@grafana/data';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

export interface SaveToNewDashboardDTO {
  dashboardName: string;
  folderId: number;
  queries: DataQuery[];
  visualization: string;
}

const createDashboard = (dashboardName: string, folderId: number, queries: DataQuery[], visualization: string) => {
  const dashboard = getDashboardSrv().create({ title: dashboardName }, { folderId });

  dashboard.addPanel({ targets: queries, type: visualization, title: 'New Panel' });

  return getDashboardSrv().saveDashboard({ dashboard, folderId }, { showErrorAlert: false, showSuccessAlert: false });
};

export const addToDashboard = async (data: SaveToNewDashboardDTO): Promise<string> => {
  const res = await createDashboard(data.dashboardName, data.folderId, data.queries, data.visualization);
  return res.data.url;
};
