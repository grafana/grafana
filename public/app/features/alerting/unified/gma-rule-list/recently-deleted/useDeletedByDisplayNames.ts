import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';

/** One batched lookup; a failed one must not disable the row - callers fall back to the UID, then "Unknown". */
export function useDeletedByDisplayNames(updatedByKeys: Array<string | undefined>) {
  const uniqueKeys = Array.from(new Set(updatedByKeys.filter((key): key is string => Boolean(key))));

  const { data } = useGetDisplayMappingQuery(uniqueKeys.length > 0 ? { key: uniqueKeys } : skipToken);

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
      resolve: (updatedBy: string | undefined) => displayNameByKey.get(updatedBy ?? ''),
    };
  }, [data]);
}
