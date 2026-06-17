import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo, useState } from 'react';

import { useListStarsQuery } from 'app/api/clients/collections/v1alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { getMessageFromError } from 'app/core/utils/errors';
import { type DashboardViewItem } from 'app/features/search/types';
import { resolveStarredFolders, starredFolderUids } from 'app/features/stars/folders';

type UseGetStarredFoldersResult = {
  folders: DashboardViewItem[];
  error: Error | undefined;
};

/**
 * Returns the current user's explicitly-starred folders, resolved to view items with real UIDs.
 *
 * The picker's RTK `searchDashboardsAndFolders` endpoint has no UID filter, so titles are resolved
 * through the unified searcher by name. Items carry their real backend UID so selecting one saves
 * into the real folder.
 */
export function useGetStarredFolders(options?: { skip: boolean }): UseGetStarredFoldersResult {
  const name = `user-${contextSrv.user.uid}`;
  const { data, error } = useListStarsQuery(options?.skip ? skipToken : { fieldSelector: `metadata.name=${name}` });

  const uids = useMemo(() => starredFolderUids(data), [data]);
  const [folders, setFolders] = useState<DashboardViewItem[]>([]);

  useEffect(() => {
    // Clear synchronously when there's nothing to resolve so we never schedule an async state update
    // after render — consumers that render the picker with the feature off (e.g. unrelated component
    // tests) would otherwise see an update outside act().
    if (uids.length === 0) {
      setFolders([]);
      return;
    }

    let cancelled = false;
    resolveStarredFolders(uids)
      .then((items) => {
        if (!cancelled) {
          setFolders(items);
        }
      })
      .catch(() => {
        // Searcher failures are non-fatal here; the starred section just stays empty.
      });
    return () => {
      cancelled = true;
    };
  }, [uids]);

  return {
    folders,
    error: error ? new Error(getMessageFromError(error)) : undefined,
  };
}
