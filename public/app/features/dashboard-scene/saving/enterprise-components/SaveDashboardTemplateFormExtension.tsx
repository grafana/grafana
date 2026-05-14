import { type ComponentType } from 'react';

import { type DashboardScene } from '../../scene/DashboardScene';
import { type DashboardChangeInfo } from '../shared';

export interface SaveDashboardTemplateFormProps {
  dashboard: DashboardScene;
  changeInfo: DashboardChangeInfo;
}

let InternalSaveDashboardTemplateForm: ComponentType<SaveDashboardTemplateFormProps> | null = null;

export function registerSaveDashboardTemplateForm(component: ComponentType<SaveDashboardTemplateFormProps>) {
  InternalSaveDashboardTemplateForm = component;
}

export function getSaveDashboardTemplateForm(): ComponentType<SaveDashboardTemplateFormProps> | null {
  return InternalSaveDashboardTemplateForm;
}
