import { getBackendSrv } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { DashboardModel } from 'app/features/dashboard/state';
import { dispatch } from 'app/store/store';
import { DashboardDataDTO, DashboardMeta } from 'app/types/dashboard';

export interface PublicDashboardConfig {
  isPublic: boolean;
  publicDashboard: {
    uid: string;
    dashboardUid: string;
    orgId: number;
    timeSettings?: object;
  };
}
export interface DashboardResponse {
  dashboard: DashboardDataDTO;
  meta: DashboardMeta;
}

export const dashboardCanBePublic = (dashboard: DashboardModel): boolean => {
  return dashboard?.templating?.list.length === 0;
};

export const getDashboard = async (dashboardUid: string, setDashboard: Function) => {
  const url = `/api/dashboards/uid/${dashboardUid}`;
  const dashResp: DashboardResponse = await getBackendSrv().get(url);
  setDashboard(new DashboardModel(dashResp.dashboard, dashResp.meta));
};

export const getPublicDashboardConfig = async (dashboardUid: string, setPublicDashboardConfig: Function) => {
  const url = `/api/dashboards/uid/${dashboardUid}/public-config`;
  const pdResp: PublicDashboardConfig = await getBackendSrv().get(url);
  setPublicDashboardConfig(pdResp);
};

export const savePublicDashboardConfig = async (
  dashboardUid: string,
  publicDashboardConfig: PublicDashboardConfig,
  setPublicDashboardConfig: Function
) => {
  const url = `/api/dashboards/uid/${dashboardUid}/public-config`;
  const pdResp: PublicDashboardConfig = await getBackendSrv().post(url, publicDashboardConfig);
  dispatch(notifyApp(createSuccessNotification('Dashboard sharing configuration saved')));
  setPublicDashboardConfig(pdResp);
};
