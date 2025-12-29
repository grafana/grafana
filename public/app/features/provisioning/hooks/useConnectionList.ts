import { skipToken } from '@reduxjs/toolkit/query';

import { ListConnectionApiArg, Connection, useListConnectionQuery } from 'app/api/clients/provisioning/v0alpha1';

// Sort connections alphabetically by name
export function useConnectionList(
  options: ListConnectionApiArg | typeof skipToken = {}
): [Connection[] | undefined, boolean] {
  const query = useListConnectionQuery(options);
  const collator = new Intl.Collator(undefined, { numeric: true });

  const sortedItems = query.data?.items?.slice().sort((a, b) => {
    const nameA = a.metadata?.name ?? '';
    const nameB = b.metadata?.name ?? '';
    return collator.compare(nameA, nameB);
  });

  return [sortedItems, query.isLoading];
}
