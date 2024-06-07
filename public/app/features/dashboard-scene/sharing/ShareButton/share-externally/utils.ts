import { config, featureEnabled } from '@grafana/runtime';

export enum PublicDashboardShareType {
  PUBLIC = 'public',
  EMAIL = 'email',
}

export const isPublicDashboardsEnabled = () => {
  return Boolean(config.featureToggles.publicDashboards) && config.publicDashboardsEnabled;
};

export const isEmailSharingEnabled = () =>
  isPublicDashboardsEnabled() &&
  !!config.featureToggles.publicDashboardsEmailSharing &&
  featureEnabled('publicDashboardsEmailSharing');
