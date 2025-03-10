import { GitHubRepositoryConfig, LocalRepositoryConfig, RepositorySpec } from './api';

export type RepositoryFormData = Omit<RepositorySpec, 'github' | 'local'> &
  GitHubRepositoryConfig &
  LocalRepositoryConfig;

// Added to DashboardDTO to help editor
export interface ProvisioningPreview {
  repo: string;
  file: string;
  ref?: string;
}

export type WorkflowOption = 'branch' | 'write';
