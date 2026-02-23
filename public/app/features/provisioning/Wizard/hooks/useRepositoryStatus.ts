import { skipToken } from '@reduxjs/toolkit/query';

import { useListRepositoryQuery } from 'app/api/clients/provisioning/v0alpha1';

import { isResourceReconciled } from '../../utils/repositoryStatus';

export function useRepositoryStatus(repoName?: string) {
  const query = useListRepositoryQuery(
    repoName
      ? {
          fieldSelector: `metadata.name=${repoName}`,
          watch: true,
        }
      : skipToken
  );

  const repository = query.data?.items?.[0];
  const { healthy: rawIsHealthy, message: healthMessage } = repository?.status?.health || {};
  const fieldErrors = repository?.status?.fieldErrors;

  const isReconciled = isResourceReconciled(repository);
  const isReady = Boolean(repoName) && query.isSuccess;

  // Only trust health status after reconciliation completes - K8s may report unreliable values during reconciliation
  const isHealthy = isReady && rawIsHealthy === true && isReconciled;
  const isUnhealthy = isReady && rawIsHealthy === false && isReconciled;
  // True when health status is not yet determined (waiting for reconciliation)
  const healthStatusNotReady = isReady && !isHealthy && !isUnhealthy;

  return {
    isReady,
    isHealthy, // true only when healthy AND reconciled
    isUnhealthy, // true only when unhealthy AND reconciled
    isReconciled,
    healthMessage,
    healthStatusNotReady, // true when waiting for reconciliation
    fieldErrors,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    hasError: query.isError,
    refetch: query.refetch,
  };
}
