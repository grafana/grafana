import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useRef, useState } from 'react';

import { useListRepositoryQuery } from 'app/api/clients/provisioning/v0alpha1';

export type UseRepositoryStatusOptions = {
  pollIntervalMs?: number;
  stopPollingWhenReady?: boolean;
};

const TIMEOUT_MS = 30000; // 30 seconds

export function useRepositoryStatus(repoName?: string, options?: UseRepositoryStatusOptions) {
  const query = useListRepositoryQuery(
    repoName
      ? {
          fieldSelector: `metadata.name=${repoName}`,
          watch: true,
        }
      : skipToken
  );

  const repository = query.data?.items?.[0];
  const { healthy: isHealthy, message: healthMessage, checked } = repository?.status?.health || {};
  console.log('stat', repository?.status);
  const healthStatusNotReady = isHealthy === false && repository?.status?.observedGeneration === 0;
  const isReady = Boolean(repoName) && query.isSuccess && !healthStatusNotReady;

  const [hasTimedOut, setHasTimedOut] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Reset timeout when repository becomes healthy
  useEffect(() => {
    if (isHealthy === true) {
      setHasTimedOut(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    }
  }, [isHealthy]);

  // Start timeout when repoName is provided and repository is not healthy
  useEffect(() => {
    if (!repoName) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
      setHasTimedOut(false);
      return;
    }

    // Only start timeout if we're waiting for health status
    // Don't start if already timed out, already healthy, or if we haven't received data yet
    if (!hasTimedOut && isHealthy !== true && query.isSuccess) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setHasTimedOut(true);
      }, TIMEOUT_MS);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    };
  }, [repoName, hasTimedOut, isHealthy, query.isSuccess]);

  const resetTimeout = () => {
    setHasTimedOut(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    // Restart timeout if still not healthy
    if (repoName && isHealthy !== true && query.isSuccess) {
      timeoutRef.current = setTimeout(() => {
        setHasTimedOut(true);
      }, TIMEOUT_MS);
    }
  };

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
    hasTimedOut,
    resetTimeout,
  };
}
