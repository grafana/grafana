// repoType = string because this repoType is coming from URL param
import { buildCleanBaseUrl } from '../../utils/git';

export const getBranchUrl = (baseUrl: string, branch: string, repoType?: string): string => {
  if (repoType === 'local') {
    return '';
  }

  const cleanBaseUrl = buildCleanBaseUrl(baseUrl);

  switch (repoType) {
    case 'githubEnterprise':
    case 'github':
      return `${cleanBaseUrl}/tree/${branch}`;
    case 'gitlab':
      return `${cleanBaseUrl}/-/tree/${branch}`;
    case 'bitbucket':
      return `${cleanBaseUrl}/src/${branch}`;
    case 'git':
      // Pure git has no standard branch deep-link; return empty so the branch renders as text
      // instead of a misleading link to the repository root on the default branch.
      return '';
    default:
      return '';
  }
};
