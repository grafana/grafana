import { skipToken } from '@reduxjs/toolkit/query';

import { ListRepositoryApiArg, Repository, useListRepositoryQuery } from '../../../api/clients/provisioning';

// Sort repositories alphabetically by title
export function useRepositoryList(
  options: ListRepositoryApiArg | typeof skipToken = {}
): [Repository[] | undefined, boolean] {
  // TODO Fix watch blocking requests
  if (typeof options === 'object' && 'watch' in options && options.watch) {
    options.watch = false;
  }
  const query = useListRepositoryQuery(options);
  const collator = new Intl.Collator(undefined, { numeric: true });

  const sortedItems = query.data?.items?.slice().sort((a, b) => {
    const titleA = a.spec?.title ?? '';
    const titleB = b.spec?.title ?? '';
    return collator.compare(titleA, titleB);
  });

  return [sortedItems, query.isLoading];
}
