export const SUPPORTED_GIT_PROVIDERS = ['github', 'gitlab', 'bitbucket'];

export function isSupportedGitProvider(provider: string) {
  return SUPPORTED_GIT_PROVIDERS.includes(provider);
}
