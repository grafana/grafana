import { SUPPORTED_GIT_PROVIDERS } from './constants';
import {
  BitbucketResponse,
  GitHubRepository,
  GitLabProject,
  GitProviderApiResponse,
  HttpError,
} from './types/repository';

// Type guards for different Git provider responses
export function isGitHubResponse(data: GitProviderApiResponse): data is GitHubRepository[] {
  return Array.isArray(data) && (data.length === 0 || 'clone_url' in data[0]);
}

export function isGitLabResponse(data: GitProviderApiResponse): data is GitLabProject[] {
  return Array.isArray(data) && (data.length === 0 || 'path_with_namespace' in data[0]);
}

export function isBitbucketResponse(data: GitProviderApiResponse): data is BitbucketResponse {
  return !Array.isArray(data) && 'values' in data && Array.isArray(data.values);
}

export function isSupportedGitProvider(provider: string): provider is 'github' | 'gitlab' | 'bitbucket' {
  return SUPPORTED_GIT_PROVIDERS.includes(provider);
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof Error && 'status' in err;
}
