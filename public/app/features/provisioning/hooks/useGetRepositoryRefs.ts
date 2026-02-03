/**
 * A hook to fetch all branches from a given repository using internal /refs endpoint
 * Used to populate the branch dropdown in onboarding wizard
 */
import { skipToken } from '@reduxjs/toolkit/query';

import { useGetRepositoryRefsQuery } from '@grafana/api-clients/rtkq/provisioning/v0alpha1';
import { t } from '@grafana/i18n';

import { useRepositoryStatus } from '../Wizard/hooks/useRepositoryStatus';
import { RepoType } from '../Wizard/types';
import { getErrorMessage } from '../utils/httpUtils';
import { isGitProvider } from '../utils/repositoryTypes';

export interface UseGetRepositoryRefsProps {
  repositoryType: RepoType;
  repositoryName?: string;
}

export function useGetRepositoryRefs({ repositoryType, repositoryName }: UseGetRepositoryRefsProps) {
  const {
    isReady: isRepositoryReady,
    isLoading: isRepositoryLoading,
    hasError: isRepoError,
  } = useRepositoryStatus(repositoryName);

  const {
    data: branchData,
    isLoading: branchLoading,
    error: branchError,
  } = useGetRepositoryRefsQuery(
    !repositoryName || !isGitProvider(repositoryType) || !isRepositoryReady ? skipToken : { name: repositoryName }
  );

  const repositoryNotReady = !isRepositoryReady && !isRepoError;
  const branchOptions = branchData?.items.map((item) => ({ label: item.name, value: item.name })) ?? [];

  return {
    options: branchOptions,
    loading: branchLoading || isRepositoryLoading || repositoryNotReady,
    error: isRepoError
      ? t(
          'provisioning.connect-step.text-repository-not-ready',
          'There was an issue connecting to the repository. You can still manually enter the branch name.'
        )
      : branchError
        ? getErrorMessage(branchError)
        : null,
    branchData,
  };
}
