import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useMemo } from 'react';

import { useListPlaylistQuery } from 'app/api/clients/playlist/v1';

import { isManaged } from '../../utils/managedResource';

interface PlaylistRow {
  uid: string;
  title: string;
}

interface State {
  data: PlaylistRow[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Lists the playlists that are candidates for migration: every playlist on the
 * instance that isn't already owned by a manager (Git Sync, Terraform, …).
 * Playlists are not folder-scoped, so they're surfaced as a flat list rather
 * than nested under folders like dashboards.
 *
 * `enabled` gates the query on whether the playlist kind is actually available
 * for provisioning (see `availableResources`); when disabled the hook does no
 * work and returns an empty list.
 */
export function usePlaylistMigrationData(enabled: boolean): State {
  const { data, isLoading, isError, refetch: baseRefetch } = useListPlaylistQuery(enabled ? {} : skipToken);

  // A skipped query can't be refetched (RTK Query throws), so make refetch a
  // no-op when the kind is disabled — callers refresh blindly after a migration.
  const refetch = useCallback(() => {
    if (enabled) {
      baseRefetch();
    }
  }, [enabled, baseRefetch]);

  const rows = useMemo<PlaylistRow[]>(() => {
    return (
      (data?.items ?? [])
        // Already-managed playlists aren't migration targets. `isManaged` is the
        // shared presence-check on the manager annotation, so it also covers
        // managers we don't explicitly enumerate.
        .filter((playlist) => !isManaged(playlist))
        .map((playlist) => ({
          uid: playlist.metadata?.name ?? '',
          title: playlist.spec?.title || playlist.metadata?.name || '',
        }))
        .filter((row) => row.uid)
    );
  }, [data]);

  return {
    data: rows,
    // With the query skipped, RTK Query reports `isLoading: false`/`isError:
    // false` already, but be explicit so a disabled kind never blocks or errors
    // the table.
    isLoading: enabled ? isLoading : false,
    isError: enabled ? isError : false,
    refetch,
  };
}
