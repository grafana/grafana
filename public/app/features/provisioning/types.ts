import { GitHubRepositoryConfig, LocalRepositoryConfig, RepositorySpec, S3RepositoryConfig } from './api/types';

export type RepositoryFormData = GitHubRepositoryConfig &
  S3RepositoryConfig &
  LocalRepositoryConfig &
  Omit<RepositorySpec, 'github' | 's3' | 'local'>;
