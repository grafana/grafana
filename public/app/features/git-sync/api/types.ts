import { Resource, ResourceForCreate, ResourceList } from '../../apiserver/types';

export type GitHubRepository = {
  branchWorkflow?: boolean;
  generateDashboardPreviews?: boolean;
  owner?: string;
  repository?: string;
};

export type LocalRepository = {
  path?: string;
};

export type S3Repository = {
  bucket?: string;
};

export type RepositorySpec = {
  folderUid?: string;
  github?: GitHubRepository;
  local?: LocalRepository;
  s3?: S3Repository;
};

export interface RequestArg {
  /** Repository UID */
  name: string;
}

export interface UpdateRequestArg extends RequestArg {
  /** RepositorySpec */
  body: ResourceForCreate<RepositorySpec>;
}

export type RepositoryList = ResourceList<RepositorySpec>;

export type RepositoryResource = Resource<RepositorySpec>;
