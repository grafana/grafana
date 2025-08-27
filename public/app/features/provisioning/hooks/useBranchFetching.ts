import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { isSupportedGitProvider } from '../guards';
import { BranchInfo, UseBranchFetchingProps } from '../types/repository';
import { fetchAllBranches, getErrorMessage, parseRepositoryUrl } from '../utils/httpUtils';

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

      const branchData = await fetchAllBranches(repositoryType, repoInfo.owner, repoInfo.repo, trimmedToken);

      return branchData.map((branch) => ({
        name: branch.name,
      }));
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
