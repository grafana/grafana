import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo, useState } from 'react';

import { useListStarsQuery } from 'app/api/clients/collections/v1alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { getMessageFromError } from 'app/core/utils/errors';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { queryResultToViewItem } from 'app/features/search/service/utils';
import { type DashboardViewItem } from 'app/features/search/types';

type UseGetStarredFoldersResult = {
  folders: DashboardViewItem[];
  isLoading: boolean;
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
  const { data, isLoading, error } = useListStarsQuery(
    options?.skip ? skipToken : { fieldSelector: `metadata.name=${name}` }
  );

  const folderUids = useMemo(() => {
    const items = data?.items ?? [];
    return items.length
      ? (items[0].spec.resource.find((r) => r.group === 'folder.grafana.app' && r.kind === 'Folder')?.names ?? [])
      : [];
  }, [data]);

  const [folders, setFolders] = useState<DashboardViewItem[]>([]);
  const [resolving, setResolving] = useState(false);
  // Stable key so the resolve effect only re-runs when the set of starred folder UIDs actually changes.
  const uidKey = useMemo(() => [...folderUids].sort().join(','), [folderUids]);

  useEffect(() => {
    if (!uidKey) {
      setFolders([]);
      return;
    }

    const uids = uidKey.split(',');
    let cancelled = false;
    setResolving(true);

    getGrafanaSearcher()
      .search({ kind: ['folder'], name: uids, limit: uids.length })
      .then((resp) => {
        if (cancelled) {
          return;
        }
        setFolders(resp.view.map((v) => queryResultToViewItem(v, resp.view)));
        setResolving(false);
      })
      .catch(() => {
        if (!cancelled) {
          setResolving(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [uidKey]);

  return {
    folders,
    isLoading: isLoading || resolving,
    error: error ? new Error(getMessageFromError(error)) : undefined,
  };
}
