import { GitHubRepositoryConfig, LocalRepositoryConfig, RepositorySpec } from './api';

export type RepositoryFormData = GitHubRepositoryConfig &
  LocalRepositoryConfig &
  Omit<RepositorySpec, 'github' | 'local'>;

// Added to DashboardDTO to help editor
export interface ProvisioningPreview {
  repo: string;
  file: string;
  ref?: string;
}

export type WorkflowOption = 'branch' | 'push';
