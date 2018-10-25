import { DashboardAcl } from './acl';

export interface Organization {
  name: string;
  id: number;
}

export interface OrganisationPreferences {
  homeDashboardId: number;
  theme: string;
  timezone: string;
}

export interface OrganisationState {
  organisation: Organization;
  preferences: OrganisationPreferences;
  starredDashboards: DashboardAcl[];
}
