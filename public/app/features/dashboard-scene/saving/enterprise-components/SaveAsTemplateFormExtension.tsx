import { type ComponentType } from 'react';

import { type DashboardScene } from '../../scene/DashboardScene';
import { type DashboardChangeInfo } from '../shared';

export interface SaveAsTemplateFormProps {
  dashboard: DashboardScene;
  changeInfo: DashboardChangeInfo;
}

let InternalSaveAsTemplateForm: ComponentType<SaveAsTemplateFormProps> | null = null;

export function registerSaveAsTemplateForm(component: ComponentType<SaveAsTemplateFormProps>) {
  InternalSaveAsTemplateForm = component;
}

export function getSaveAsTemplateForm(): ComponentType<SaveAsTemplateFormProps> | null {
  return InternalSaveAsTemplateForm;
}
