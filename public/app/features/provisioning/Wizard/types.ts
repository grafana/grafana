import { RepositoryFormData } from '../types';

export type WizardStep = 'connection' | 'repository' | 'export' | 'provisioning';

export interface ConnectionFormData {
  type: 'github' | 'local' | 's3';
  title: string;
  mode: 'empty' | 'import' | 'folder';
}

export interface GithubRepositoryFormData {
  token: string;
  url: string;
  branch: string;
  workflows: string[];
  generateDashboardPreviews: boolean;
}

export interface LocalRepositoryFormData {
  path: string;
}

export interface S3RepositoryFormData {
  bucket: string;
  region: string;
}

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
