import { GitHubRepositoryConfig, LocalRepositoryConfig, S3RepositoryConfig } from './api/types';

export type RepositoryFormData = GitHubRepositoryConfig &
  S3RepositoryConfig &
  LocalRepositoryConfig & {
    title: string;
    description?: string;
    folder?: string;
    type: 'github' | 'local' | 's3';
  };

// Added to DashboardDTO to help editor
export interface ProvisioningPreview {
  repo: string;
  file: string;
  ref?: string;
}
