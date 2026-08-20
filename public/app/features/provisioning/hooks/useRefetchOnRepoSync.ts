import { skipToken } from '@reduxjs/toolkit/query/react';
import { useEffect, useRef } from 'react';

import { useListRepositoryQuery } from 'app/api/clients/provisioning/v0alpha1';

/**
 * Calls `refetch` once each time the repository finishes a successful (or
 * warning) pull sync, so cached reads — README/doc content and the folder's
 * file listing — pick up remote changes (added/removed/renamed files) without a
 * page reload.
 *
 * Watches the durable repository sync status rather than the Job, since the Job
 * is deleted on completion and its terminal state is never observable (#1223).
 * `finished` advances once per completed pull; the ref dedupes repeat watch
 * events and seeds a baseline so mount-loaded data isn't refetched immediately.
 *
 * Returns the latest `status.sync.finished` timestamp so callers can key other
 * cache refreshes (e.g. a resource listing) off the same signal.
 */
export function useRefetchOnRepoSync(repositoryName: string | undefined, refetch: () => void): number | undefined {
  const { data } = useListRepositoryQuery(
    repositoryName ? { fieldSelector: `metadata.name=${repositoryName}`, watch: true } : skipToken
  );
  const repo = data?.items?.[0];
  const sync = repo?.status?.sync;
  const syncFinished = sync?.finished;

  const lastFinishedRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!repo) {
      return;
    }
    const finished = syncFinished ?? 0;
    if (lastFinishedRef.current === undefined) {
      lastFinishedRef.current = finished;
      return;
    }
    // sync only advances on pull, so push/pr/move/delete never reach here.
    if (finished > lastFinishedRef.current && (sync?.state === 'success' || sync?.state === 'warning')) {
      lastFinishedRef.current = finished;
      refetch();
    }
  }, [repo, sync, syncFinished, refetch]);

  return syncFinished;
}
