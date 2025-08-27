import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { isBitbucketResponse, isGitHubResponse, isGitLabResponse, isSupportedGitProvider } from '../guards';
import {
  GitProviderApiResponse,
  RepositoryOption,
  UseRepositoryFetchingProps,
  UseRepositoryFetchingResult,
} from '../types/repository';
import { createApiRequest, getErrorMessage, makeApiRequest } from '../utils/httpUtils';

export function useRepositoryFetching({
  repositoryType,
  repositoryToken,
}: UseRepositoryFetchingProps): UseRepositoryFetchingResult {
  const hasRequiredData = useMemo(() => {
    if (!isSupportedGitProvider(repositoryType)) {
      return false;
    }
    return repositoryToken && repositoryToken.trim().length > 0;
  }, [repositoryType, repositoryToken]);

  const fetchRepositories = useMemo(
    () => async (): Promise<RepositoryOption[]> => {
      if (!hasRequiredData) {
        return [];
      }

      const apiConfig = createApiRequest(repositoryType, repositoryToken);
      const data: GitProviderApiResponse = await makeApiRequest(apiConfig.repositories);

      if (isGitHubResponse(data)) {
        return data.map((repo) => ({
          fullName: repo.full_name,
          url: repo.clone_url,
        }));
      } else if (isGitLabResponse(data)) {
        return data.map((project) => ({
          fullName: project.path_with_namespace,
          url: project.http_url_to_repo,
        }));
      } else if (isBitbucketResponse(data)) {
        return data.values.map((repo) => ({
          fullName: repo.full_name,
          url: repo.links.clone.find((link) => link.name === 'https')?.href || '',
        }));
      }

      return [];
    },
    [hasRequiredData, repositoryToken, repositoryType]
  );

  const asyncState = useAsync(fetchRepositories, [fetchRepositories]);

  return {
    repositories: asyncState.value || [],
    loading: asyncState.loading,
    error: asyncState.error ? getErrorMessage(asyncState.error) : null,
  };
}
