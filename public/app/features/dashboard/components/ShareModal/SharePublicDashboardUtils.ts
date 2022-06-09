import { getBackendSrv } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { VariableModel } from 'app/features/variables/types';
import { dispatch } from 'app/store/store';
import { DashboardDataDTO, DashboardMeta } from 'app/types/dashboard';

export interface PublicDashboard {
  uid: string;
  dashboardUid: string;
  timeSettings?: object;
  isPublic: boolean;
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
  setPublicDashboardConfig: React.Dispatch<React.SetStateAction<PublicDashboard>>
) => {
  const url = `/api/dashboards/uid/${dashboardUid}/public-config`;
  const pdResp: PublicDashboard = await getBackendSrv().get(url);
  setPublicDashboardConfig(pdResp);
};

export const savePublicDashboardConfig = async (
  dashboardUid: string,
  publicDashboardConfig: PublicDashboard,
  setPublicDashboardConfig: Function
) => {
  const url = `/api/dashboards/uid/${dashboardUid}/public-config`;
  const pdResp: PublicDashboard = await getBackendSrv().post(url, publicDashboardConfig);
  // Never allow a user to send the orgId
  delete pdResp.orgId;
  dispatch(notifyApp(createSuccessNotification('Dashboard sharing configuration saved')));
  setPublicDashboardConfig(pdResp);
};

export const generatePublicDashboardUrl = (publicDashboard: PublicDashboard) => {
  return 'POTATES';
};
