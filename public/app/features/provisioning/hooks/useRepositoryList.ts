import { skipToken } from '@reduxjs/toolkit/query';

import { ListRepositoryApiArg, Repository, useListRepositoryQuery } from 'app/api/clients/provisioning/v0alpha1';

// Sort repositories alphabetically by title
export function useRepositoryList(
  options: ListRepositoryApiArg | typeof skipToken = {}
): [Repository[] | undefined, boolean] {
  const query = useListRepositoryQuery(options);
  const collator = new Intl.Collator(undefined, { numeric: true });

  const sortedItems = query.data?.items?.slice().sort((a, b) => {
    const titleA = a.spec?.title ?? '';
    const titleB = b.spec?.title ?? '';
    return collator.compare(titleA, titleB);
  });

  return [sortedItems, query.isLoading];
}
