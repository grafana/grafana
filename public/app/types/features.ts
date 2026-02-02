export interface TenantFeatureDTO {
  Name: string;
  State: string;
  Status: boolean;
  Solution: string;
  Description: string;
  FeatureLevel: string;
  id: number;
  Tenant: string;
}

export interface GrafanaFeatureDTO {
  featureName: string;
  status: boolean;
  orgId: number;
  id: number;
}

//Add constant for every feature flag created.
//constant value must be same as feature Name.
export enum DashboardFeatures {}

export const Key_Enabled_Features = 'enabledFeatures';
export const Key_Grafana_Enabled_Feature = 'grafanaEnabledFeatures';
export const Key_Features_List = 'featuresList';
