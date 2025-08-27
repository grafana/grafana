/**
 * A hook to fetch all branches from a given repository.
 * Used to populate the branch dropdown in the repository selection.
 * We can't use the '/ref` endpoint at this point because the repository connection hasn't been created yet.
 */
import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { RepoType } from '../Wizard/types';
import { isSupportedGitProvider } from '../guards';
import { fetchAllBranches, getErrorMessage, parseRepositoryUrl } from '../utils/httpUtils';

export interface UseBranchOptionsProps {
  repositoryType: RepoType;
  repositoryUrl: string;
  repositoryToken: string;
}

export function useBranchOptions({ repositoryType, repositoryUrl = '', repositoryToken = '' }: UseBranchOptionsProps) {
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

  const fetchOptions = useMemo(
    () => async (): Promise<Array<{ label: string; value: string }>> => {
      if (!hasRequiredData) {
        return [];
      }

      const repoInfo = parseRepositoryUrl(trimmedUrl, repositoryType);

      if (!repoInfo) {
        throw new Error('Invalid repository URL format');
      }

      const branchData = await fetchAllBranches(repositoryType, repoInfo.owner, repoInfo.repo, trimmedToken);

      return branchData.map((branch) => ({
        label: branch.name,
        value: branch.name,
      }));
    },
    [hasRequiredData, trimmedUrl, trimmedToken, repositoryType]
  );

  const asyncState = useAsync(fetchOptions, [fetchOptions]);

  return {
    options: asyncState.value || [],
    loading: asyncState.loading,
    error: asyncState.error ? getErrorMessage(asyncState.error) : null,
  };
}
