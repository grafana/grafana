import { WorkflowOption } from '../types';

export interface BaseProvisionedFormData {
  ref?: string;
  path: string;
  comment?: string;
  repo: string;
  workflow?: WorkflowOption;
  title: string;
}

export interface ProvisionedDashboardFormData extends BaseProvisionedFormData {
  description: string;
  folder: {
    uid?: string;
    title?: string;
  };
}
