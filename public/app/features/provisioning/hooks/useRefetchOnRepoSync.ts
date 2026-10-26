import { skipToken } from '@reduxjs/toolkit/query/react';
import { useEffect, useRef } from 'react';

import { type Repository, useListRepositoryQuery } from 'app/api/clients/provisioning/v0alpha1';

/**
 * `finished` of the newest completed pull, or 0 when none has completed. The outcome is not
 * consulted: a pull that ends in `error` has usually applied every resource but the ones it
 * reports, and the status only holds the last pull, so a success followed by a failure while the
 * caller was unmounted would otherwise go unnoticed.
 */
export function lastSyncFinished(repositories: Repository[]): number {
  let latest = 0;
  for (const { status } of repositories) {
    latest = Math.max(latest, status?.sync?.finished ?? 0);
  }
  return latest;
}

/**
 * Calls `refetch` once each time the repository finishes a pull sync, so cached
 * reads — README/doc content and the folder's file listing — pick up remote
 * changes (added/removed/renamed files) without a page reload.
 *
 * Watches the durable repository sync status rather than the Job, since the Job
 * is deleted on completion and its terminal state is never observable (#1223).
 * The ref dedupes repeat watch events and seeds a baseline so mount-loaded data
 * isn't refetched immediately.
 *
 * Returns the latest `status.sync.finished` timestamp so callers can key other
 * cache refreshes (e.g. a resource listing) off the same signal.
 */
export function useRefetchOnRepoSync(repositoryName: string | undefined, refetch: () => void): number | undefined {
  const { data } = useListRepositoryQuery(
    repositoryName ? { fieldSelector: `metadata.name=${repositoryName}`, watch: true } : skipToken
  );
  const repo = data?.items?.[0];
  const lastSync = repo ? lastSyncFinished([repo]) : undefined;

  const baseline = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (lastSync === undefined) {
      return;
    }
    if (baseline.current === undefined) {
      baseline.current = lastSync;
      return;
    }
    if (lastSync > baseline.current) {
      baseline.current = lastSync;
      refetch();
    }
  }, [lastSync, refetch]);

  return repo?.status?.sync?.finished;
}
