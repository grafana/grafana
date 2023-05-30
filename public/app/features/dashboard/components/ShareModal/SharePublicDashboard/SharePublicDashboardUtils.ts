import { getConfig } from 'app/core/config';
import { VariableModel } from 'app/features/variables/types';

import { PanelModel } from '../../../state';

import { supportedDatasources } from './SupportedPubdashDatasources';

export enum PublicDashboardShareType {
  PUBLIC = 'public',
  EMAIL = 'email',
}

export interface PublicDashboardSettings {
  annotationsEnabled: boolean;
  isEnabled: boolean;
  timeSelectionEnabled: boolean;
}

export interface PublicDashboard extends PublicDashboardSettings {
  accessToken?: string;
  uid: string;
  dashboardUid: string;
  timeSettings?: object;
  share: PublicDashboardShareType;
  recipients?: Array<{ uid: string; recipient: string }>;
}

export interface SessionDashboard {
  dashboardTitle: string;
  dashboardUid: string;
  publicDashboardAccessToken: string;
}

export interface SessionUser {
  email: string;
  firstSeenAtAge: string;
  totalDashboards: number;
}

// Instance methods
export const dashboardHasTemplateVariables = (variables: VariableModel[]): boolean => {
  return variables.length > 0;
};

export const publicDashboardPersisted = (publicDashboard?: PublicDashboard): boolean => {
  return publicDashboard?.uid !== '' && publicDashboard?.uid !== undefined;
};

/**
 * Get unique datasource names from all panels that are not currently supported by public dashboards.
 */
export const getUnsupportedDashboardDatasources = (panels: PanelModel[]): string[] => {
  let unsupportedDS = new Set<string>();

  for (const panel of panels) {
    for (const target of panel.targets) {
      let ds = target?.datasource?.type;
      if (ds && !supportedDatasources.has(ds)) {
        unsupportedDS.add(ds);
      }
    }
  }

  return Array.from(unsupportedDS).sort();
};

/**
 * Generate the public dashboard url. Uses the appUrl from the Grafana boot config, so urls will also be correct
 * when Grafana is hosted on a subpath.
 *
 * All app urls from the Grafana boot config end with a slash.
 *
 * @param accessToken
 */
export const generatePublicDashboardUrl = (accessToken: string): string => {
  return `${getConfig().appUrl}public-dashboards/${accessToken}`;
};

export const generatePublicDashboardConfigUrl = (dashboardUid: string): string => {
  return `/d/${dashboardUid}?shareView=public-dashboard`;
};

export const validEmailRegex = /^[A-Z\d._%+-]+@[A-Z\d.-]+\.[A-Z]{2,}$/i;
