export interface HttpError extends Error {
  status?: number;
}

export function isSupportedGitProvider(provider: string): provider is 'github' | 'gitlab' | 'bitbucket' {
  return ['github', 'gitlab', 'bitbucket'].includes(provider);
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof Error && 'status' in err;
}
