import { RepositoryFormData } from '../types';

export type WizardStep = 'connection' | 'repository' | 'migrate' | 'pull';

export interface MigrateFormData {
  dashboards: string[];
  folders: string[];
  history: boolean;
  identifier: boolean;
}

export interface WizardFormData {
  repository: RepositoryFormData;
  migrate?: MigrateFormData;
  repositoryName?: string;
}

export type ValidationResult = {
  valid: boolean;
  errors?: string[];
};
