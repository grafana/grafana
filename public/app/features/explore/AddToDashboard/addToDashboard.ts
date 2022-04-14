import { DataQuery, DataSourceRef } from '@grafana/data';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

export interface SaveToNewDashboardDTO {
  dashboardName: string;
  folderId: number;
}
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

export const addToDashboard = async (data: SaveToNewDashboardDTO, options: SaveOptions): Promise<string> => {
  const res = await createDashboard(
    data.dashboardName,
    data.folderId,
    options.queries,
    options.datasource,
    options.panel
  );
  return res.data.url;
};
