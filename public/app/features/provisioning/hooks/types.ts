import { RepoType } from '../Wizard/types';

export interface BranchInfo {
  name: string;
  isDefault?: boolean;
}

export interface RepositoryInfo {
  owner: string;
  repo: string;
}

export interface RepositoryOption {
  fullName: string;
  url: string;
}

export interface HttpError extends Error {
  status?: number;
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof Error && 'status' in err;
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

export interface UseRepositoryFetchingProps {
  repositoryType: RepoType;
  repositoryToken: string;
}

export interface UseRepositoryFetchingResult {
  repositories: RepositoryOption[];
  loading: boolean;
  error: string | null;
}

// Git provider response types
export interface GitHubRepository {
  full_name: string;
  clone_url: string;
}

export interface GitLabProject {
  path_with_namespace: string;
  http_url_to_repo: string;
}

export interface BitbucketCloneLink {
  name: string;
  href: string;
}

export interface BitbucketRepository {
  full_name: string;
  links: {
    clone: BitbucketCloneLink[];
  };
}

export interface BitbucketResponse {
  values: BitbucketRepository[];
}

// Union type for all possible API responses
export type GitProviderApiResponse = GitHubRepository[] | GitLabProject[] | BitbucketResponse;
