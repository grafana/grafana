import { RepoType } from '../Wizard/types';

export interface BranchInfo {
  name: string;
  isDefault?: boolean;
}

export interface RepositoryInfo {
  owner: string;
  repo: string;
}

export interface HttpError extends Error {
  status?: number;
}

export interface UseBranchOptionsProps {
  repositoryType: RepoType;
  repositoryUrl: string;
  repositoryToken: string;
}

// Repository refs API response types
export interface RepositoryRef {
  name: string;
  hash: string;
  refURL: string;
}

export interface RepositoryRefsResponse {
  kind: string;
  apiVersion: string;
  metadata: Record<string, unknown>;
  items: RepositoryRef[];
}
