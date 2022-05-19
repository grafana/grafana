import { getBackendSrv } from '@grafana/runtime';
import { DashboardModel } from 'app/features/dashboard/state';

export interface PublicDashboardConfig {
  isPublic: boolean;
  publicDashboard: {
    uid: string;
    dashboardUid: string;
    orgId: number;
    refreshRate?: number;
    templateVariables?: object;
    timeVariables?: object;
  };
}

export const dashboardCanBePublic = (dashboard: DashboardModel): boolean => {
  return dashboard?.templating?.list.length === 0;
};

export const getPublicDashboardConfig = async (dashboardUid: string) => {
  const url = `/api/dashboards/uid/${dashboardUid}/public-config`;
  return getBackendSrv().get(url);
};

export const savePublicDashboardConfig = async (dashboardUid: string, publicDashboardConfig: PublicDashboardConfig) => {
  const url = `/api/dashboards/uid/${dashboardUid}/public-config`;
  return getBackendSrv().post(url, publicDashboardConfig);
};
