import { AlertVariant } from '@grafana/ui';

import { ListOptions, Resource, ResourceForCreate, ResourceList } from '../../apiserver/types';

export type GitHubRepositoryConfig = {
  branchWorkflow?: boolean;
  generateDashboardPreviews?: boolean;
  pullRequestLinter?: boolean;
  owner: string;
  repository: string;
  token?: string;
  branch?: string;
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
  linting?: boolean;
};

export type RepositoryStatus = {
  hash?: string; // ??? TODO
};

export type EditingOptions = {
  create: boolean;
  delete: boolean;
  update: boolean;
};

export type TestResponse = {
  apiVersion?: string;
  kind?: string;
  code: number;
  success: boolean;
  errors?: string[];
  details?: object;
};

export interface RequestArg {
  /** Repository UID */
  name: string;
  ref?: string;
}

export interface GetRequestArg extends RequestArg {
  path: string;
}

export type RepositoryForCreate = ResourceForCreate<RepositorySpec>;
export interface UpdateRequestArg extends RequestArg {
  /** RepositorySpec */
  body: ResourceForCreate<RepositorySpec>;
}

export type RepositoryResource = Resource<RepositorySpec, RepositoryStatus, 'Repository'>;
export type RepositoryList = ResourceList<RepositorySpec, RepositoryStatus, 'Repository'>;

export type JobSpec = {
  action: 'export' | 'merge' | 'pr';
  ref?: string;
  pr?: number;
  hash?: string;
  url?: string;
  commits?: CommitInfo[];
};

export type FileRef = {
  path: string;
  ref: string;
};

export type CommitInfo = {
  added?: FileRef[];
  modified?: FileRef[];
  removed?: FileRef[];
  sha1?: string;
};

export type JobStatus = {
  updated?: string; // actually a date...
  state: 'pending' | 'working' | 'success' | 'error';
  message?: string;
  errors?: string[];
};

export type JobResource = Resource<JobSpec, JobStatus, 'Job'>;
export type JobList = ResourceList<JobSpec, JobStatus, 'Job'>;

export type ResourceObjects = {
  type?: {
    group?: string;
    version?: string;
    kind?: string;
    resource?: string;
    classic?: string;
  };
  file?: Resource;
  existing?: Resource;
  dryRun?: Resource;
};

export type ResourceWrapper = {
  apiVersion?: string;
  kind?: string;
  errors?: string[];
  hash?: string;
  path?: string;
  ref?: string;
  timestamp?: string;
  resource: ResourceObjects;
  lint?: LintResult[];
};

export type LintResult = {
  severity: AlertVariant; // mostly true!
  rule: string;
  message: string;
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

export type FileDetails = {
  path: string;
  size: string;
  hash: string;
};

export type ListFilesApiResponse = {
  apiVersion?: string;
  files?: FileDetails[];
  kind?: string;
  metadata?: any;
};

export type HistoryListResponse = {
  apiVersion?: string;
  kind?: string;
  metadata?: any;
  items?: HistoryItem[];
};

export type HistoryItem = {
  ref: string;
  message: string;
  createdAt?: number;
  authors: AuthorInfo[];
};

export type AuthorInfo = {
  name: string;
  username: string;
  avatarURL?: string;
};

export type WebhookResponse = {
  added?: string;
  apiVersion?: string;
  code?: number;
  job?: JobSpec;
  kind?: string;
};

export interface ListApiArg extends ListOptions {
  allowWatchBookmarks?: boolean;
  resourceVersion?: string;
  resourceVersionMatch?: string;
  sendInitialEvents?: boolean;
  timeoutSeconds?: number;
  watch?: boolean;
}

export type ExportOptions = {
  folder?: string;
  branch?: string; // '*dummy*' will trigger fake export
  prefix?: string;
  history: boolean;
};
