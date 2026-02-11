/**
 * A hook to fetch all branches from a given repository using internal /refs endpoint
 * Used to populate the branch dropdown in onboarding wizard
 */
import { skipToken } from '@reduxjs/toolkit/query';

import { useGetRepositoryRefsQuery } from '@grafana/api-clients/rtkq/provisioning/v0alpha1';
import { t } from '@grafana/i18n';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';

import { useRepositoryStatus } from '../Wizard/hooks/useRepositoryStatus';
import { RepoType } from '../Wizard/types';
import { isGitProvider } from '../utils/repositoryTypes';

export interface UseGetRepositoryRefsProps {
  repositoryType: RepoType;
  repositoryName?: string;
}

export function useGetRepositoryRefs({ repositoryType, repositoryName }: UseGetRepositoryRefsProps) {
  const {
    isLoading: isRepositoryLoading,
    hasError: isRepoError,
    isReconciled,
    healthStatusNotReady,
  } = useRepositoryStatus(repositoryName);

  const shouldSkipQuery = !repositoryName || !isGitProvider(repositoryType) || !isReconciled;
  const {
    data: branchData,
    isLoading: branchLoading,
    error: branchError,
  } = useGetRepositoryRefsQuery(shouldSkipQuery ? skipToken : { name: repositoryName });

  const branchOptions = branchData?.items.map((item) => ({ label: item.name, value: item.name })) ?? [];

  return {
    options: branchOptions,
    loading: branchLoading || isRepositoryLoading || healthStatusNotReady,
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
