import { Resource, ResourceForCreate, ResourceList } from '../../apiserver/types';

export type GitHubRepositoryConfig = {
  branchWorkflow?: boolean;
  generateDashboardPreviews?: boolean;
  owner?: string;
  repository?: string;
};

export type LocalRepositoryConfig = {
  path?: string;
};

export type S3RepositoryConfig = {
  bucket?: string;
  region?: string;
};

export type RepositorySpec = {
  description?: string;
  folder?: string;
  github?: GitHubRepositoryConfig;
  local?: LocalRepositoryConfig;
  s3?: S3RepositoryConfig;
  type: 'github' | 'local' | 's3';
};

export type WatchEvent = {
  object: unknown;
  type: string;
};

export interface RequestArg {
  /** Repository UID */
  name: string;
}

export type RepositoryForCreate = ResourceForCreate<RepositorySpec>;
export interface UpdateRequestArg extends RequestArg {
  /** RepositorySpec */
  body: ResourceForCreate<RepositorySpec>;
}

export type RepositoryList = ResourceList<RepositorySpec>;

export type RepositoryResource = Resource<RepositorySpec>;

export type HelloWorld = {
  apiVersion?: string;
  kind?: string;
  whom?: string;
};
