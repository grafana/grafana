import { useCallback, useMemo, useState } from 'react';

import { PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { isLoading, useAsync } from '../../hooks/useAsync';

/**
 * Provides pagination functionality for rule groups with lazy loading.
 * Instead of loading all groups at once, it uses a generator to fetch them in batches as needed,
 * which helps with performance when dealing with large numbers of rules.
 *
 * @param groupsGenerator - An async generator that yields rule groups in batches
 * @param pageSize - Number of groups to display per page
 * @returns Pagination state and controls for navigating through rule groups
 */
export function usePaginatedPrometheusGroups<TGroup extends PromRuleGroupDTO>(
  groupsGenerator: AsyncGenerator<TGroup, void, unknown>,
  pageSize: number
) {
  const [currentPage, setCurrentPage] = useState(1);
  const [groups, setGroups] = useState<TGroup[]>([]);
  const [lastPage, setLastPage] = useState<number | undefined>(undefined);

  const [{ execute: fetchMoreGroups }, groupsRequestState] = useAsync(async (groupsCount: number) => {
    let done = false;
    const currentGroups: TGroup[] = [];

    while (currentGroups.length < groupsCount) {
      const generatorResult = await groupsGenerator.next();
      if (generatorResult.done) {
        done = true;
        break;
      }
      const group = generatorResult.value;
      currentGroups.push(group);
    }

    if (done) {
      const groupsTotal = groups.length + currentGroups.length;
      setLastPage(Math.ceil(groupsTotal / pageSize));
    }

    setGroups((groups) => [...groups, ...currentGroups]);
  });

  // lastPage could be computed from groups.length and pageSize
  const fetchInProgress = isLoading(groupsRequestState);
  const canMoveForward = !fetchInProgress && (!lastPage || currentPage < lastPage);
  // When going backward we already have the groups loaded, so no need to check if fetchInProgress
  const canMoveBackward = currentPage > 1;

  const nextPage = useCallback(async () => {
    if (canMoveForward) {
      setCurrentPage((page) => page + 1);
    }
  }, [canMoveForward]);

  const previousPage = useCallback(async () => {
    if (canMoveBackward) {
      setCurrentPage((page) => page - 1);
    }
  }, [canMoveBackward]);

  // groups.length - pageSize to have one more page loaded to prevent flickering with loading state
  // lastPage === undefined because 0 is falsy but a value which should stop fetching (e.g for broken data sources)
  const shouldFetchNextPage = groups.length - pageSize < pageSize * currentPage && lastPage === undefined;

  if (shouldFetchNextPage && !fetchInProgress) {
    fetchMoreGroups(pageSize);
  }

  const groupsPage = useMemo(() => {
    return groups.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [groups, currentPage, pageSize]);

  return { isLoading: fetchInProgress, page: groupsPage, nextPage, previousPage, canMoveForward, canMoveBackward };
}
