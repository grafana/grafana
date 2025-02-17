import { RepositoryFormData } from '../types';

export type WizardStep = 'connection' | 'repository' | 'export' | 'provisioning';

export interface ExportFormData {
  dashboards: string[];
  folders: string[];
}

export interface WizardFormData {
  repository: RepositoryFormData;
  export?: ExportFormData;
  repositoryName?: string;
}

export type ValidationResult = {
  valid: boolean;
  errors?: string[];
};
