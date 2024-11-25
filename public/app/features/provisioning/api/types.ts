import { Resource, ResourceForCreate, ResourceList } from '../../apiserver/types';

export type GitHubRepositoryConfig = {
  branchWorkflow?: boolean;
  generateDashboardPreviews?: boolean;
  owner: string;
  repository: string;
  token?: string;
};

export type LocalRepositoryConfig = {
  path?: string;
};

export type S3RepositoryConfig = {
  bucket?: string;
  region?: string;
};

export type RepositorySpec = {
  title?: string;
  description?: string;
  folder?: string;
  github?: GitHubRepositoryConfig;
  local?: LocalRepositoryConfig;
  s3?: S3RepositoryConfig;
  type: 'github' | 'local' | 's3';
  editing: EditingOptions;
  preferYaml?: boolean;
};

export type EditingOptions = {
  create: boolean;
  delete: boolean;
  update: boolean;
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

export type WebhookResponse = {
  apiVersion?: string;
  kind?: string;
  status?: string;
};

export type ResourceObjects = {
  dryRun?: any;
  file?: any;
  store?: any;
};

export type ResourceWrapper = {
  apiVersion?: string;
  kind?: string;
  errors?: string[];
  hash?: string;
  path?: string;
  ref?: string;
  resource: ResourceObjects;
  timestamp?: string;
};

export type FileOperationArg = {
  name: string;
  path: string;
  body: object;
  message?: string;
  ref?: string;
};

export type GetFileArg = {
  name: string;
  path: string;
  ref?: string;
};
