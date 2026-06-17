import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useState } from 'react';

import { useListStarsQuery } from 'app/api/clients/collections/v1alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { getMessageFromError } from 'app/core/utils/errors';
import { type DashboardViewItem } from 'app/features/search/types';
import { resolveStarredFolders } from 'app/features/stars/folders';

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

  const [folders, setFolders] = useState<DashboardViewItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    resolveStarredFolders(data)
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
  }, [data]);

  return {
    folders,
    error: error ? new Error(getMessageFromError(error)) : undefined,
  };
}
