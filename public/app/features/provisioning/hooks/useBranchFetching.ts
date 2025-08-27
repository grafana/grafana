import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { isSupportedGitProvider } from '../guards';
import { BranchInfo, RepositoryInfo, UseBranchFetchingProps } from '../types/repository';
import { getBranchesUrl, getErrorMessage, getProviderHeaders, makeApiRequest } from '../utils/httpUtils';

const githubUrlRegex = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/?$/;
const gitlabUrlRegex = /^https:\/\/gitlab\.com\/([^\/]+)\/([^\/]+)\/?$/;
const bitbucketUrlRegex = /^https:\/\/bitbucket\.org\/([^\/]+)\/([^\/]+)\/?$/;

function parseRepositoryUrl(url: string, type: string): RepositoryInfo | null {
  let match: RegExpMatchArray | null = null;

  switch (type) {
    case 'github':
      match = url.match(githubUrlRegex);
      break;
    case 'gitlab':
      match = url.match(gitlabUrlRegex);
      break;
    case 'bitbucket':
      match = url.match(bitbucketUrlRegex);
      break;
    default:
      return null;
  }

  if (match && match[1] && match[2]) {
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, ''),
    };
  }

  return null;
}

export function useBranchFetching({
  repositoryType,
  repositoryUrl = '',
  repositoryToken = '',
}: UseBranchFetchingProps) {
  const trimmedUrl = repositoryUrl.trim();
  const trimmedToken = repositoryToken.trim();

  const hasRequiredData = useMemo(() => {
    if (!isSupportedGitProvider(repositoryType)) {
      return false;
    }

    const hasUrl = trimmedUrl.length > 0;
    const hasToken = trimmedToken.length > 0;
    const repoInfo = hasUrl ? parseRepositoryUrl(trimmedUrl, repositoryType) : null;

    return hasUrl && hasToken && repoInfo !== null;
  }, [trimmedUrl, trimmedToken, repositoryType]);

  const fetchBranches = useMemo(
    () => async (): Promise<BranchInfo[]> => {
      if (!hasRequiredData) {
        return [];
      }

      const repoInfo = parseRepositoryUrl(trimmedUrl, repositoryType);

      if (!repoInfo) {
        throw new Error('Invalid repository URL format');
      }

      const headers = getProviderHeaders(repositoryType, trimmedToken);
      const url = getBranchesUrl(repositoryType, repoInfo.owner, repoInfo.repo);
      const data = await makeApiRequest({ url, headers });

      let branchData: BranchInfo[] = [];

      if (repositoryType === 'github') {
        if (Array.isArray(data)) {
          branchData = data.map((branch: { name: string }) => ({
            name: branch.name,
          }));
        }
      } else if (repositoryType === 'gitlab') {
        if (Array.isArray(data)) {
          branchData = data.map((branch: { name: string }) => ({
            name: branch.name,
          }));
        }
      } else if (repositoryType === 'bitbucket') {
        if (data && Array.isArray(data.values)) {
          branchData = data.values.map((branch: { name: string }) => ({
            name: branch.name,
          }));
        }
      }

      return branchData;
    },
    [hasRequiredData, trimmedUrl, trimmedToken, repositoryType]
  );

  const asyncState = useAsync(fetchBranches, [fetchBranches]);

  return {
    branches: asyncState.value || [],
    loading: asyncState.loading,
    error: asyncState.error ? getErrorMessage(asyncState.error) : null,
  };
}
