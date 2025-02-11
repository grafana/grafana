import { GitHubRepositoryConfig, LocalRepositoryConfig, RepositorySpec, S3RepositoryConfig } from './api';

export type RepositoryFormData = Omit<GitHubRepositoryConfig, 'owner' | 'repository'> &
  S3RepositoryConfig &
  LocalRepositoryConfig &
  Omit<RepositorySpec, 'github' | 's3' | 'local'> & {
    repositoryUrl?: string;
  };

// Added to DashboardDTO to help editor
export interface ProvisioningPreview {
  repo: string;
  file: string;
  ref?: string;
}

export type WorkflowOption = 'branch' | 'push';
