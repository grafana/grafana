import { type ComponentType } from 'react';

export interface DashboardTemplatesTabProps {
  isOpen: boolean;
  onClose: () => void;
}

let InternalDashboardTemplatesTab: ComponentType<DashboardTemplatesTabProps> | null = null;

export function registerDashboardTemplatesTab(component: ComponentType<DashboardTemplatesTabProps>) {
  InternalDashboardTemplatesTab = component;
}

export function getDashboardTemplatesTab(): ComponentType<DashboardTemplatesTabProps> | null {
  return InternalDashboardTemplatesTab;
}
