import { type ComponentType } from 'react';

export interface DashboardTemplateSettingsTabProps {
  dashboardTemplateUid: string;
}

export type DashboardTemplateSettingsTabComponent = ComponentType<DashboardTemplateSettingsTabProps>;

let internal: DashboardTemplateSettingsTabComponent | undefined;

export function registerDashboardTemplateSettingsTab(component: DashboardTemplateSettingsTabComponent) {
  internal = component;
}

export function getDashboardTemplateSettingsTab(): DashboardTemplateSettingsTabComponent | undefined {
  return internal;
}
