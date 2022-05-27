import { getBackendSrv } from '@grafana/runtime';
import { DashboardModel } from 'app/features/dashboard/state';

export interface PublicDashboardConfig {
  isPublic: boolean;
}

export const dashboardCanBePublic = (dashboard: DashboardModel): boolean => {
  return dashboard?.templating?.list.length === 0;
};

export const getPublicDashboardConfig = async (dashboardUid: string) => {
  const url = `/api/dashboards/uid/${dashboardUid}/public-config`;
  return getBackendSrv().get(url);
};

export const savePublicDashboardConfig = async (dashboardUid: string, conf: PublicDashboardConfig) => {
  const payload = { isPublic: conf.isPublic };
  const url = `/api/dashboards/uid/${dashboardUid}/public-config`;
  return getBackendSrv().post(url, payload);
};
