import { type skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useMemo } from 'react';

import {
  type ListConnectionApiArg,
  provisioningAPIv0alpha1,
  useListConnectionQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { useDispatch } from 'app/types/store';

// Sort connections alphabetically by name
export function useConnectionList(options: ListConnectionApiArg | typeof skipToken = {}) {
  const query = useListConnectionQuery(options);

  const sortedItems = useMemo(() => {
    const collator = new Intl.Collator(undefined, { numeric: true });
    return query.data?.items?.slice().sort((a, b) => {
      const nameA = a.metadata?.name ?? '';
      const nameB = b.metadata?.name ?? '';
      return collator.compare(nameA, nameB);
    });
  }, [query.data?.items]);

  return [sortedItems, query.isLoading, query.error, query.refetch] as const;
}

// Returns a callback that refetches every connection list in the app
export function useInvalidateConnectionList() {
  const dispatch = useDispatch();

  return useCallback(() => {
    dispatch(provisioningAPIv0alpha1.util.invalidateTags([{ type: 'Connection', id: 'LIST' }]));
  }, [dispatch]);
}
