import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';

/**
 * Resolves `grafana.app/updatedBy` identity keys (the deleting user, on a trash tombstone) to a
 * display name, the same API-independent lookup the folder API uses for `createdBy`/`updatedBy`
 * (see `app/api/clients/folder/v1beta1/hooks.ts`'s `resolveDisplayName`). Batched across every
 * currently loaded row into a single request rather than one per row.
 *
 * A failed or partial lookup must not disable the row it belongs to - callers fall back to the
 * raw UID, then "Unknown".
 */
export function useDeletedByDisplayNames(updatedByKeys: Array<string | undefined>) {
  const uniqueKeys = useMemo(
    () => Array.from(new Set(updatedByKeys.filter((key): key is string => Boolean(key)))),
    [updatedByKeys]
  );

  const { data, isError } = useGetDisplayMappingQuery(uniqueKeys.length > 0 ? { key: uniqueKeys } : skipToken);

  return useMemo(() => {
    const displayNameByKey = new Map<string, string>();
    if (data) {
      data.keys.forEach((key, index) => {
        const displayName = data.display[index]?.displayName;
        if (displayName) {
          displayNameByKey.set(key, displayName);
        }
      });
    }

    return {
      isError,
      resolve: (updatedBy: string | undefined) => displayNameByKey.get(updatedBy ?? ''),
    };
  }, [data, isError]);
}
