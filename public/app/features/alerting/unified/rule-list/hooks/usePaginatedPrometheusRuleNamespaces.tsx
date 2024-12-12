import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePrevious } from 'react-use';

import { PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { groupRulesByFileName } from '../../api/prometheus';
import { prometheusApi } from '../../api/prometheusApi';
import { isLoading, useAsync } from '../../hooks/useAsync';
import { getDatasourceAPIUid } from '../../utils/datasource';

const { useLazyGroupsQuery } = prometheusApi;

export function usePaginatedPrometheusRuleNamespaces(ruleSourceName: string, pageSize: number) {
  const [currentPage, setCurrentPage] = useState(1);
  const [groups, setGroups] = useState<PromRuleGroupDTO[]>([]);
  const [lastPage, setLastPage] = useState<number | undefined>(undefined);

  const { groupsGenerator } = usePrometheusGroupsGenerator(ruleSourceName, pageSize);

  const [{ execute: fetchMoreGroups }, groupsRequestState] = useAsync(async (groupsCount: number) => {
    let done = false;
    const currentGroups: PromRuleGroupDTO[] = [];

    while (currentGroups.length < groupsCount) {
      const group = await groupsGenerator.next();
      if (group.done) {
        done = true;
        break;
      }

      currentGroups.push(group.value);
    }

    if (done) {
      const groupsTotal = groups.length + currentGroups.length;
      setLastPage(Math.ceil(groupsTotal / pageSize));
    }

    setGroups((groups) => [...groups, ...currentGroups]);
  });

  const fetchInProgress = isLoading(groupsRequestState);
  const canMoveForward = !fetchInProgress && (!lastPage || currentPage < lastPage);
  const canMoveBackward = currentPage > 1 && !fetchInProgress;

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

  const pageNamespaces = useMemo(() => {
    const pageGroups = groups.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    // groupRulesByFileName mutates the array and RTKQ query freezes the response data
    return groupRulesByFileName(structuredClone(pageGroups), ruleSourceName);
  }, [groups, ruleSourceName, currentPage, pageSize]);

  return { isLoading: fetchInProgress, page: pageNamespaces, nextPage, previousPage, canMoveForward, canMoveBackward };
}

function usePrometheusGroupsGenerator(ruleSourceName: string, pageSize: number) {
  const [fetchGroups, { isLoading }] = useLazyGroupsQuery();

  const prevRuleSourceName = usePrevious(ruleSourceName);
  // Generator lazily provides groups one by one only when needed
  // This might look a bit complex but it allows us to have one API for paginated and non-paginated Prometheus data sources
  // For unpaginated data sources we just fetch everything in one go
  // For paginated we fetch the next page when needed
  const getGroups = useCallback(
    async function* (ruleSourceName: string, maxGroups: number) {
      const ruleSourceUid = getDatasourceAPIUid(ruleSourceName);

      const response = await fetchGroups({
        ruleSource: { uid: ruleSourceUid },
        groupLimit: maxGroups,
      });

      if (!response.isSuccess) {
        return;
      }

      if (response.data?.data) {
        yield* response.data.data.groups;
      }

      let lastToken: string | undefined = undefined;
      if (response.data?.data?.groupNextToken) {
        lastToken = response.data.data.groupNextToken;
      }

      while (lastToken) {
        const response = await fetchGroups({
          ruleSource: { uid: ruleSourceUid },
          groupNextToken: lastToken,
          groupLimit: maxGroups,
        });

        if (!response.isSuccess) {
          return;
        }

        if (response.data?.data) {
          yield* response.data.data.groups;
        }

        lastToken = response.data?.data?.groupNextToken;
      }
    },
    [fetchGroups]
  );

  const [groupsGenerator, setGroupsGenerator] = useState<AsyncGenerator<PromRuleGroupDTO, void, unknown>>(
    getGroups(ruleSourceName, pageSize)
  );

  const resetGenerator = useCallback(() => {
    setGroupsGenerator(getGroups(ruleSourceName, pageSize));
  }, [ruleSourceName, getGroups, pageSize]);

  if (prevRuleSourceName && prevRuleSourceName !== ruleSourceName) {
    resetGenerator();
  }

  useEffect(() => {
    const currentGenerator = groupsGenerator;
    return () => {
      currentGenerator.return();
    };
  }, [groupsGenerator]);

  return { groupsGenerator, isLoading };
}
