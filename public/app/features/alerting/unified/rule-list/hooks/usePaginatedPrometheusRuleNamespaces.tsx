import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

import { PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { groupRulesByFileName } from '../../api/prometheus';
import { prometheusApi } from '../../api/prometheusApi';
import { RulesFilter } from '../../search/rulesSearchParser';
import { getDatasourceAPIUid } from '../../utils/datasource';

const { useLazyGroupsQuery } = prometheusApi;

export function usePaginatedPrometheusRuleNamespaces(
  ruleSourceName: string,
  pageSize: number,
  filterState: RulesFilter
) {
  const [fetchGroups, { isLoading }] = useLazyGroupsQuery();
  const [currentPage, setCurrentPage] = useState(1);
  const [groups, setGroups] = useState<PromRuleGroupDTO[]>([]);
  const [lastPage, setLastPage] = useState<number | undefined>(undefined);

  // Generator lazily provides groups one by one only when needed
  // This might look a bit complex but it allows us to have one API for paginated and non-paginated Prometheus data sources
  // For unpaginated data sources we just fetch everything in one go
  // For paginated we fetch the next page when needed
  const getGroups = async function* () {
    const ruleSourceUid = getDatasourceAPIUid(ruleSourceName);

    const response = await fetchGroups({
      ruleSource: { uid: ruleSourceUid },
      maxGroups: 5,
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
        maxGroups: 100,
      });

      if (response.data?.data) {
        yield* response.data.data.groups;
      }

      lastToken = response.data?.data?.nextToken;
    }
  };

  const groupsGenerator = useRef<AsyncGenerator<PromRuleGroupDTO, void, unknown>>(getGroups());

  const fetchMoreGroups = useCallback(async (groupsCount: number) => {
    let done = false;
    const groups: PromRuleGroupDTO[] = [];

    for (let i = 0; i < groupsCount; i++) {
      const group = await groupsGenerator.current.next();
      if (group.done) {
        done = true;
        break;
      }
      groups.push(group.value);
    }

    return { groups, done };
  }, []);

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

  useEffect(() => {
    // We fetch 2 pages to load the page in the background rather than waiting for the user to click next
    if (groups.length - pageSize < pageSize * currentPage) {
      fetchMoreGroups(pageSize * 2).then((result) => {
        setGroups((groups) => [...groups, ...result.groups]);
        if (result.done) {
          setLastPage(currentPage);
        }
      });
    }
  }, [fetchMoreGroups, groups.length, pageSize, currentPage]);

  const pageNamespaces = useMemo(() => {
    const pageGroups = groups.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    // groupRulesByFileName mutates the array and RTKQ query freezes the response data
    return groupRulesByFileName(structuredClone(pageGroups), ruleSourceName);
  }, [groups, ruleSourceName, currentPage, pageSize]);

  return { isLoading, page: pageNamespaces, nextPage, previousPage, canMoveForward, canMoveBackward };
}
