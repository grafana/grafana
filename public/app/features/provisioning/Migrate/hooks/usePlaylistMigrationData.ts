import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useMemo } from 'react';

import { useListPlaylistQuery } from 'app/api/clients/playlist/v1';
import { AnnoKeyManagerKind } from 'app/features/apiserver/types';

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
    return (data?.items ?? [])
      .filter((playlist) => !playlist.metadata?.annotations?.[AnnoKeyManagerKind])
      .map((playlist) => ({
        uid: playlist.metadata?.name ?? '',
        title: playlist.spec?.title || playlist.metadata?.name || '',
      }))
      .filter((row) => row.uid);
  }, [data]);

  return {
    data: rows,
    // With the query skipped, RTK Query reports `isLoading: false` already, but
    // be explicit so callers never block the table on a disabled kind.
    isLoading: enabled ? isLoading : false,
    isError,
    refetch,
  };
}
