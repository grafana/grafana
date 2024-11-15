import { GitHubRepositoryConfig, LocalRepositoryConfig, S3RepositoryConfig } from './api/types';

export type RepositoryFormData = GitHubRepositoryConfig &
  S3RepositoryConfig &
  LocalRepositoryConfig & {
    description?: string;
    folder?: string;
    type: 'github' | 'local' | 's3';
  };
