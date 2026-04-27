import { type ComponentType } from 'react';

import { type DashboardScene } from '../../scene/DashboardScene';
import { type DashboardChangeInfo } from '../shared';

export interface SaveOrgTemplateFormProps {
  dashboard: DashboardScene;
  changeInfo: DashboardChangeInfo;
}

let InternalSaveOrgTemplateForm: ComponentType<SaveOrgTemplateFormProps> | null = null;

export function registerSaveOrgTemplateForm(component: ComponentType<SaveOrgTemplateFormProps>) {
  InternalSaveOrgTemplateForm = component;
}

export function getSaveOrgTemplateForm(): ComponentType<SaveOrgTemplateFormProps> | null {
  return InternalSaveOrgTemplateForm;
}
