import { RepoType, RepoTypeDisplay } from './Wizard/types';

export interface HttpError extends Error {
  status?: number;
}

export function isSupportedGitProvider(provider: string): provider is 'gitlab' | 'bitbucket' {
  // GitHub is excluded because the GitHub flow creates the repo one step earlier, so it can already use the internal /refs endpoint.
  return ['gitlab', 'bitbucket'].includes(provider);
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof Error && 'status' in err;
}

export function isValidRepoType(repoType: string | undefined): repoType is RepoType {
  if (typeof repoType !== 'string') {
    return false;
  }
  return repoType in RepoTypeDisplay;
}
