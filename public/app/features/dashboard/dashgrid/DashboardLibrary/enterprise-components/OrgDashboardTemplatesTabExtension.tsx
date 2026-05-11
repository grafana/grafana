import { type ComponentType } from 'react';

export interface OrgDashboardTemplatesTabProps {
  isOpen: boolean;
  onClose: () => void;
}

let InternalOrgDashboardTemplatesTab: ComponentType<OrgDashboardTemplatesTabProps> | null = null;

export function registerOrgDashboardTemplatesTab(component: ComponentType<OrgDashboardTemplatesTabProps>) {
  InternalOrgDashboardTemplatesTab = component;
}

export function getOrgDashboardTemplatesTab(): ComponentType<OrgDashboardTemplatesTabProps> | null {
  return InternalOrgDashboardTemplatesTab;
}
