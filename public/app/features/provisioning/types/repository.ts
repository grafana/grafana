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

export interface UseBranchFetchingProps {
  repositoryType: RepoType;
  repositoryUrl: string;
  repositoryToken: string;
}

export interface UseBranchFetchingResult {
  branches: BranchInfo[];
  loading: boolean;
  error: string | null;
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
