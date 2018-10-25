export interface Organisation {
  name: string;
  id: number;
}

export interface OrganisationPreferences {
  homeDashboardId: number;
  theme: string;
  timezone: string;
}

export interface OrganisationState {
  organisation: Organisation;
  preferences: OrganisationPreferences;
}
