/**
 * A hook to fetch all branches from a given repository using internal /refs endpoint
 * Used to populate the branch dropdown in the repository selection.
 */
import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { useGetRepositoryRefsQuery } from '@grafana/api-clients/rtkq/provisioning/v0alpha1';

import { useRepositoryStatus } from '../Wizard/hooks/useRepositoryStatus';
import { RepoType } from '../Wizard/types';
import { getErrorMessage } from '../utils/httpUtils';
import { isGitProvider } from '../utils/repositoryTypes';

export interface UseGetRepositoryRefsProps {
  repositoryType: RepoType;
  repositoryTokenUser?: string;
  repositoryName?: string;
}

export function useGetRepositoryRefs({ repositoryType, repositoryName }: UseGetRepositoryRefsProps) {
  const { isReady: isRepositoryReady, isLoading: isRepositoryLoading, hasError } = useRepositoryStatus(repositoryName);

  const {
    data: branchData,
    isLoading: branchLoading,
    error: branchError,
  } = useGetRepositoryRefsQuery(
    !repositoryName || !isGitProvider(repositoryType) || !isRepositoryReady ? skipToken : { name: repositoryName }
  );

  const repositoryNotReady = !repositoryName || (!isRepositoryReady && !hasError);
  const branchOptions = useMemo(
    () => branchData?.items.map((item) => ({ label: item.name, value: item.name })) ?? [],
    [branchData?.items]
  );

  return {
    options: branchOptions,
    loading: branchLoading || isRepositoryLoading || repositoryNotReady,
    error: branchError ? getErrorMessage(branchError) : null,
    branchData,
  };
}
