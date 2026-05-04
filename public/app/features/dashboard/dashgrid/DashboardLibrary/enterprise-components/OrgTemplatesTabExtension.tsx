import { type ComponentType } from 'react';

export interface OrgTemplatesTabProps {
  isOpen: boolean;
  onClose: () => void;
}

let InternalOrgTemplatesTab: ComponentType<OrgTemplatesTabProps> | null = null;

export function registerOrgTemplatesTab(component: ComponentType<OrgTemplatesTabProps>) {
  InternalOrgTemplatesTab = component;
}

export function getOrgTemplatesTab(): ComponentType<OrgTemplatesTabProps> | null {
  return InternalOrgTemplatesTab;
}
