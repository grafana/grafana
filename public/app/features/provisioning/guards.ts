import { type RepoType, RepoTypeDisplay } from './Wizard/types';

export interface HttpError extends Error {
  status?: number;
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
