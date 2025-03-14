import { skipToken } from '@reduxjs/toolkit/query';

import { ListRepositoryArg, Repository, useListRepositoryQuery } from '../api';

// Sort repositories alphabetically by title
export function useRepositoryList(
  options: ListRepositoryArg | typeof skipToken = {}
): [Repository[] | undefined, boolean] {
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
