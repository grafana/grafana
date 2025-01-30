import { GitHubRepositoryConfig, LocalRepositoryConfig, RepositorySpec, S3RepositoryConfig } from './api';

export type RepositoryFormData = GitHubRepositoryConfig &
  S3RepositoryConfig &
  LocalRepositoryConfig &
  Omit<RepositorySpec, 'github' | 's3' | 'local'>;

// Added to DashboardDTO to help editor
export interface ProvisioningPreview {
  repo: string;
  file: string;
  ref?: string;
}

export enum WorkflowOption {
  Direct = 'direct',
  PullRequest = 'pr',
}
