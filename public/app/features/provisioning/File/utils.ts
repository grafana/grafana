export function isFileHistorySupported(repoType?: string | null): boolean {
  const supportedRepoTypes = new Set(['github', 'githubEnterprise', 'gitlab', 'bitbucket']);
  return !!repoType && supportedRepoTypes.has(repoType);
}
