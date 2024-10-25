import { useState, useCallback, useEffect, useMemo, useDeferredValue } from 'react';
import { usePrevious } from 'react-use';

import { PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { groupRulesByFileName } from '../../api/prometheus';
import { prometheusApi } from '../../api/prometheusApi';
import { getDatasourceAPIUid } from '../../utils/datasource';

export function usePaginatedPrometheusRuleNamespaces(ruleSourceName: string, pageSize: number) {
  const [currentPage, setCurrentPage] = useState(1);
  const [groups, setGroups] = useState<PromRuleGroupDTO[]>([]);
  const [lastPage, setLastPage] = useState<number | undefined>(undefined);

  const defferedGroups = useDeferredValue(groups);

  const { groupsGenerator, isLoading } = usePrometheusGroupsGenerator(ruleSourceName, pageSize);

  const fetchMoreGroups = useCallback(
    async (groupsCount: number) => {
      let done = false;
      const currentGroups = [];

      while (currentGroups.length < groupsCount) {
        const group = await groupsGenerator.next();
        if (group.done) {
          done = true;
          break;
        }

        currentGroups.push(group.value);
      }

      return { done, groups: currentGroups };
    },
    [groupsGenerator]
  );

  const canMoveForward = !lastPage || currentPage < lastPage;
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

  // useEffect(() => {
  // We fetch 2 pages to load the page in the background rather than waiting for the user to click next
  if (groups.length - pageSize < pageSize * currentPage) {
    fetchMoreGroups(pageSize * 2).then((result) => {
      if (result.done) {
        setLastPage(currentPage);
      }
      setGroups((groups) => [...groups, ...result.groups]);
    });
  }

  const pageNamespaces = useMemo(() => {
    const pageGroups = defferedGroups.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    // groupRulesByFileName mutates the array and RTKQ query freezes the response data
    return groupRulesByFileName(structuredClone(pageGroups), ruleSourceName);
  }, [defferedGroups, ruleSourceName, currentPage, pageSize]);

  return { isLoading, page: pageNamespaces, nextPage, previousPage, canMoveForward, canMoveBackward };
}

const { useLazyGroupsQuery } = prometheusApi;

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
        maxGroups,
      });

      // TODO Add filtering
      if (response.data?.data) {
        yield* response.data.data.groups;
      }

      let lastToken: string | undefined = undefined;
      if (response.data?.data?.nextToken) {
        lastToken = response.data.data.nextToken;
      }

      while (lastToken) {
        const response = await fetchGroups({
          ruleSource: { uid: ruleSourceUid },
          nextToken: lastToken,
          maxGroups,
        });

        if (response.data?.data) {
          yield* response.data.data.groups;
        }

        lastToken = response.data?.data?.nextToken;
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

  return { groupsGenerator, isLoading, resetGenerator };
}
