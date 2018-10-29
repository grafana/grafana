import { DashboardSearchHit } from './dashboardSearchHit';

export interface Organization {
  name: string;
  id: number;
}

export interface OrganizationPreferences {
  homeDashboardId: number;
  theme: string;
  timezone: string;
}

export interface OrganizationState {
  organization: Organization;
  preferences: OrganizationPreferences;
  starredDashboards: DashboardSearchHit[];
}
