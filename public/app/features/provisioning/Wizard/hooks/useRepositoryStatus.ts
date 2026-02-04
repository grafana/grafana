import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useListRepositoryQuery } from 'app/api/clients/provisioning/v0alpha1';

import { isResourceReconciled } from '../../utils/repositoryStatus';

export const TIMEOUT_MS = 30000; // 30 seconds

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

  const isReconciled = isResourceReconciled(repository);
  const isReady = Boolean(repoName) && query.isSuccess;

  // Only trust health status after reconciliation completes - K8s may report unreliable values during reconciliation
  const isHealthy = isReady && rawIsHealthy === true && isReconciled;
  const isUnhealthy = isReady && rawIsHealthy === false && isReconciled;
  // True when health status is not yet determined (waiting for reconciliation)
  const healthStatusNotReady = isReady && !isHealthy && !isUnhealthy;

  const [hasTimedOut, setHasTimedOut] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Store current values in refs for use in resetTimeout callback
  const rawIsHealthyRef = useRef(rawIsHealthy);
  const isSuccessRef = useRef(query.isSuccess);
  const repoNameRef = useRef(repoName);

  useEffect(() => {
    rawIsHealthyRef.current = rawIsHealthy;
    isSuccessRef.current = query.isSuccess;
    repoNameRef.current = repoName;
  }, [rawIsHealthy, query.isSuccess, repoName]);

  // Reset timeout when repository becomes healthy (use raw value for timeout logic)
  useEffect(() => {
    if (rawIsHealthy === true) {
      setHasTimedOut(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    }
  }, [rawIsHealthy]);

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
    // Note: The timeout intentionally restarts when rawIsHealthy or query.isSuccess changes.
    // This ensures we give a fresh 30s window after any state transition (e.g., reconnection attempts).
    if (!hasTimedOut && rawIsHealthy !== true && query.isSuccess) {
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
  }, [repoName, hasTimedOut, rawIsHealthy, query.isSuccess]);

  const resetTimeout = useCallback(() => {
    setHasTimedOut(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    // Restart timeout if still not healthy
    if (repoNameRef.current && rawIsHealthyRef.current !== true && isSuccessRef.current) {
      timeoutRef.current = setTimeout(() => {
        setHasTimedOut(true);
      }, TIMEOUT_MS);
    }
  }, []);

  return {
    isReady,
    isHealthy, // true only when healthy AND reconciled (safe to show success UI)
    isUnhealthy, // true only when unhealthy AND reconciled (safe to show error UI)
    isReconciled, // keep for useResourceStats
    healthMessage,
    healthStatusNotReady, // true when waiting for reconciliation
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    hasError: query.isError,
    refetch: query.refetch,
    hasTimedOut,
    resetTimeout,
  };
}
