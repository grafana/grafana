import { type ComponentType } from 'react';

import { type DashboardScene } from '../../scene/DashboardScene';
import { type DashboardChangeInfo } from '../shared';

export interface SaveOrgDashboardTemplateFormProps {
  dashboard: DashboardScene;
  changeInfo: DashboardChangeInfo;
}

let InternalSaveOrgDashboardTemplateForm: ComponentType<SaveOrgDashboardTemplateFormProps> | null = null;

export function registerSaveOrgDashboardTemplateForm(component: ComponentType<SaveOrgDashboardTemplateFormProps>) {
  InternalSaveOrgDashboardTemplateForm = component;
}

export function getSaveOrgDashboardTemplateForm(): ComponentType<SaveOrgDashboardTemplateFormProps> | null {
  return InternalSaveOrgDashboardTemplateForm;
}
