import { ListRepositoryArg, Repository, useListRepositoryQuery } from '../api';

// Sort repositories alphabetically by title
export function useRepositoryList(options: ListRepositoryArg = {}): [Repository[] | undefined, boolean] {
  const query = useListRepositoryQuery(options);
  const collator = new Intl.Collator(undefined, { numeric: true });

  const sortedItems = query.data?.items?.slice().sort((a, b) => {
    const titleA = a.spec?.title ?? '';
    const titleB = b.spec?.title ?? '';
    return collator.compare(titleA, titleB);
  });

  return [sortedItems, query.isLoading];
}
