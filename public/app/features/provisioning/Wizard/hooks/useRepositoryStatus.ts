import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useState } from 'react';

import { useGetRepositoryStatusQuery } from 'app/api/clients/provisioning/v0alpha1';

export type UseRepositoryStatusOptions = {
  pollIntervalMs?: number;
  stopPollingWhenReady?: boolean;
};

export function useRepositoryStatus(repoName?: string, options?: UseRepositoryStatusOptions) {
  const pollIntervalMs = options?.pollIntervalMs ?? 5000;
  const stopPollingWhenReady = options?.stopPollingWhenReady ?? true;

  const [shouldEnablePolling, setShouldEnablePolling] = useState(Boolean(repoName));

  const query = useGetRepositoryStatusQuery(repoName ? { name: repoName } : skipToken, {
    pollingInterval: repoName && shouldEnablePolling ? pollIntervalMs : 0,
    skipPollingIfUnfocused: true,
  });

  const { healthy: isHealthy, message: healthMessage, checked } = query?.data?.status?.health || {};

  const healthStatusNotReady = isHealthy === false && query?.data?.status?.observedGeneration === 0;
  const isReady = Boolean(repoName) && query.isSuccess && !healthStatusNotReady;

  useEffect(() => {
    if (!repoName) {
      setShouldEnablePolling(false);
      return;
    }
    if (query.isError) {
      setShouldEnablePolling(false);
      return;
    }
    if (stopPollingWhenReady && isReady) {
      setShouldEnablePolling(false);
      return;
    }
    setShouldEnablePolling(true);
  }, [repoName, stopPollingWhenReady, isReady, query.isError]);

  return {
    isReady,
    isHealthy: isReady ? isHealthy : undefined,
    healthMessage,
    checked,
    healthStatusNotReady,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    hasError: query.isError,
    refetch: query.refetch,
  };
}
