import { RepositoryFormData } from '../types';

export type WizardStep = 'connection' | 'repository' | 'migrate';

export interface ExportFormData {
  dashboards: string[];
  folders: string[];
  history: boolean;
  identifier: boolean;
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
