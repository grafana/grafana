import { getBackendSrv } from '@grafana/runtime';
import { DashboardModel } from 'app/features/dashboard/state';
import { DashboardDataDTO, DashboardMeta } from 'app/types/dashboard';

export interface PublicDashboardConfig {
  isPublic: boolean;
  publicDashboard: {
    uid: string;
    dashboardUid: string;
    orgId: number;
    timeVariables?: object;
  };
}

export const dashboardCanBePublic = (dashboard: DashboardModel): boolean => {
  return dashboard?.templating?.list.length === 0;
};

export const getDashboard = async (dashboardUid: string) => {
  const url = `/api/dashboards/uid/${dashboardUid}`;
  return getBackendSrv().get(url);
};

export const getPublicDashboardConfig = async (dashboardUid: string) => {
  const url = `/api/dashboards/uid/${dashboardUid}/public-config`;
  return getBackendSrv().get(url);
};

export interface DashboardResponse {
  dashboard: DashboardDataDTO;
  meta: DashboardMeta;
}

export const savePublicDashboardConfig = async (dashboardUid: string, publicDashboardConfig: PublicDashboardConfig) => {
  const url = `/api/dashboards/uid/${dashboardUid}/public-config`;
  return getBackendSrv().post(url, publicDashboardConfig);
};
