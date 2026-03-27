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
    case 'git':
      // Generic git repositories don't have a standard URL pattern for branches
      // Just return the base URL without branch segment
      return cleanBaseUrl;
    default:
      return '';
  }
};

interface BuildNewPullRequestUrlParams {
  repoUrl: string | undefined;
  repoType: string | undefined;
  baseBranch: string | undefined;
  headBranch: string | undefined;
}

/**
 * Builds a URL to create a new pull/merge request for a given branch.
 * Used as a fallback when the backend response doesn't include newPullRequestURL
 * (e.g., for directory move operations).
 */
export function buildNewPullRequestUrl({
  repoUrl,
  repoType,
  baseBranch,
  headBranch,
}: BuildNewPullRequestUrlParams): string | undefined {
  if (!repoUrl || !headBranch) {
    return undefined;
  }

  const cleanBase = buildCleanBaseUrl(repoUrl);

  switch (repoType) {
    case 'github':
      return `${cleanBase}/compare/${baseBranch ?? 'main'}...${headBranch}?expand=1`;
    case 'gitlab': {
      const params = new URLSearchParams({
        'merge_request[source_branch]': headBranch,
        'merge_request[target_branch]': baseBranch ?? 'main',
      });
      return `${cleanBase}/-/merge_requests/new?${params.toString()}`;
    }
    default:
      return undefined;
  }
}
