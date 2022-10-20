import { getConfig } from 'app/core/config';
import { VariableModel } from 'app/features/variables/types';
import { DashboardDataDTO, DashboardMeta } from 'app/types/dashboard';

export interface PublicDashboard {
  accessToken?: string;
  annotationsEnabled: boolean;
  isEnabled: boolean;
  uid: string;
  dashboardUid: string;
  timeSettings?: object;
}

export interface DashboardResponse {
  dashboard: DashboardDataDTO;
  meta: DashboardMeta;
}

export interface Acknowledgements {
  public: boolean;
  datasources: boolean;
  usage: boolean;
}

// Instance methods
export const dashboardHasTemplateVariables = (variables: VariableModel[]): boolean => {
  return variables.length > 0;
};

export const publicDashboardPersisted = (publicDashboard?: PublicDashboard): boolean => {
  return publicDashboard?.uid !== '' && publicDashboard?.uid !== undefined;
};

/**
 * Generate the public dashboard url. Uses the appUrl from the Grafana boot config, so urls will also be correct
 * when Grafana is hosted on a subpath.
 *
 * All app urls from the Grafana boot config end with a slash.
 *
 * @param publicDashboard
 */
export const generatePublicDashboardUrl = (publicDashboard: PublicDashboard): string => {
  return `${getConfig().appUrl}public-dashboards/${publicDashboard.accessToken}`;
};
