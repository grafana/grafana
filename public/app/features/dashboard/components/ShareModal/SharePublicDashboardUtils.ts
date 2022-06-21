import { getBackendSrv } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { VariableModel } from 'app/features/variables/types';
import { dispatch } from 'app/store/store';
import { DashboardDataDTO, DashboardMeta } from 'app/types/dashboard';

export interface PublicDashboardConfig {
  isPublic: boolean;
  publicDashboard: {
    uid: string;
    dashboardUid: string;
    timeSettings?: object;
  };
}
export interface DashboardResponse {
  dashboard: DashboardDataDTO;
  meta: DashboardMeta;
}

export const dashboardHasTemplateVariables = (variables: VariableModel[]): boolean => {
  return variables.length > 0;
};

export const getPublicDashboardConfig = async (
  dashboardUid: string,
  setPublicDashboardConfig: React.Dispatch<React.SetStateAction<PublicDashboardConfig>>
) => {
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
