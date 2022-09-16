import { VariableModel } from 'app/features/variables/types';
import { DashboardDataDTO, DashboardMeta } from 'app/types/dashboard';

export interface PublicDashboard {
  accessToken?: string;
  isEnabled: boolean;
  uid: string;
  dashboardUid: string;
  timeSettings?: object;
}

export interface Acknowledgements {
  public: boolean;
  datasources: boolean;
  usage: boolean;
}

export interface DashboardResponse {
  dashboard: DashboardDataDTO;
  meta: DashboardMeta;
}

// Instance methods
export const dashboardHasTemplateVariables = (variables: VariableModel[]): boolean => {
  return variables.length > 0;
};

export const publicDashboardPersisted = (publicDashboard?: PublicDashboard): boolean => {
  return publicDashboard?.uid !== '' && publicDashboard?.uid !== undefined;
};

export const generatePublicDashboardUrl = (publicDashboard: PublicDashboard): string => {
  return `${window.location.origin}/public-dashboards/${publicDashboard.accessToken}`;
};
