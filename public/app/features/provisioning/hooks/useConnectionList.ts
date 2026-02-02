import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { ListConnectionApiArg, useListConnectionQuery } from 'app/api/clients/provisioning/v0alpha1';

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

  return [sortedItems, query.isLoading, query.error] as const;
}
