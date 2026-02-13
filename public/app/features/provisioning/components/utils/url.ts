// repoType = string because this repoType is coming from URL param
import { buildCleanBaseUrl } from '../../utils/git';

export const getBranchUrl = (baseUrl: string, branch: string, repoType?: string): string => {
  if (repoType === 'local') {
    return '';
  }

  const cleanBaseUrl = buildCleanBaseUrl(baseUrl);

  switch (repoType) {
    case 'github':
      return `${cleanBaseUrl}/tree/${branch}`;
    case 'gitlab':
      return `${cleanBaseUrl}/-/tree/${branch}`;
    case 'bitbucket':
      return `${cleanBaseUrl}/src/${branch}`;
    default:
      return '';
  }
};
