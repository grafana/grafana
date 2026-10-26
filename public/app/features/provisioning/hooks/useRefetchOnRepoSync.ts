import { skipToken } from '@reduxjs/toolkit/query/react';
import { useEffect, useRef } from 'react';

import { type Repository, useListRepositoryQuery } from 'app/api/clients/provisioning/v0alpha1';

/**
 * `finished` of the newest pull that wrote content, or 0 when none has. A `warning` pull wrote
 * everything it could and only tripped a quota, so it counts; a failed pull wrote nothing and
 * advances `finished` without moving this.
 */
export function lastSuccessfulSync(repositories: Repository[]): number {
  let latest = 0;
  for (const { status } of repositories) {
    const sync = status?.sync;
    if (sync?.finished && (sync.state === 'success' || sync.state === 'warning')) {
      latest = Math.max(latest, sync.finished);
    }
  }
  return latest;
}

/**
 * Calls `refetch` once each time the repository finishes a successful (or
 * warning) pull sync, so cached reads — README/doc content and the folder's
 * file listing — pick up remote changes (added/removed/renamed files) without a
 * page reload.
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
  const lastSync = repo ? lastSuccessfulSync([repo]) : undefined;

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
