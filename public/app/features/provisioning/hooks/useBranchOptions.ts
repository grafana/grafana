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
  repositoryTokenUser?: string;
}

export function useBranchOptions({
  repositoryType,
  repositoryUrl = '',
  repositoryToken = '',
  repositoryTokenUser = '',
}: UseBranchOptionsProps) {
  const trimmedUrl = repositoryUrl.trim();
  const trimmedToken = repositoryToken.trim();
  const trimmedTokenUser = repositoryTokenUser.trim();

  const hasRequiredData = useMemo(() => {
    if (!isSupportedGitProvider(repositoryType)) {
      return false;
    }

    const hasUrl = trimmedUrl.length > 0;
    const hasToken = trimmedToken.length > 0;
    const hasTokenUser = repositoryType === 'bitbucket' ? trimmedTokenUser.length > 0 : true;
    const repoInfo = hasUrl ? parseRepositoryUrl(trimmedUrl, repositoryType) : null;

    return hasUrl && hasToken && hasTokenUser && repoInfo !== null;
  }, [trimmedUrl, trimmedToken, trimmedTokenUser, repositoryType]);

  const fetchOptions = useMemo(
    () => async (): Promise<Array<{ label: string; value: string }>> => {
      if (!hasRequiredData) {
        return [];
      }

      const repoInfo = parseRepositoryUrl(trimmedUrl, repositoryType);

      if (!repoInfo) {
        throw new Error('Invalid repository URL format');
      }

      // For Bitbucket, combine username and app password for Basic auth
      const authToken = repositoryType === 'bitbucket' ? `${trimmedTokenUser}:${trimmedToken}` : trimmedToken;
      const branchData = await fetchAllBranches(repositoryType, repoInfo.owner, repoInfo.repo, authToken);

      return branchData.map((branch) => ({
        label: branch.name,
        value: branch.name,
      }));
    },
    [hasRequiredData, trimmedUrl, trimmedToken, trimmedTokenUser, repositoryType]
  );

  const asyncState = useAsync(fetchOptions, [fetchOptions]);

  return {
    options: asyncState.value || [],
    loading: asyncState.loading,
    error: asyncState.error ? getErrorMessage(asyncState.error) : null,
  };
}
