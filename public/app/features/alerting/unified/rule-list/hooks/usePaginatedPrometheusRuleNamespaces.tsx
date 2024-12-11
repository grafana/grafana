import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePrevious } from 'react-use';

import { ExternalRulesSourceIdentifier } from 'app/types/unified-alerting';
import { PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { groupRulesByFileName } from '../../api/prometheus';
import { isLoading, useAsync } from '../../hooks/useAsync';

import { useRuleGroupsGenerator } from './prometheusGroupsGenerator';

export function usePaginatedPrometheusRuleNamespaces(
  rulesSourceIdentifier: ExternalRulesSourceIdentifier,
  pageSize: number
) {
  const [currentPage, setCurrentPage] = useState(1);
  const [groups, setGroups] = useState<PromRuleGroupDTO[]>([]);
  const [lastPage, setLastPage] = useState<number | undefined>(undefined);

  const { groupsGenerator } = usePrometheusGroupsGenerator(rulesSourceIdentifier, pageSize);

  const [{ execute: fetchMoreGroups }, groupsRequestState] = useAsync(async (groupsCount: number) => {
    let done = false;
    const currentGroups: PromRuleGroupDTO[] = [];

    while (currentGroups.length < groupsCount) {
      const generatorResult = await groupsGenerator.next();
      if (generatorResult.done) {
        done = true;
        break;
      }
      const [, group] = generatorResult.value;
      currentGroups.push(group);
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
    return groupRulesByFileName(structuredClone(pageGroups), rulesSourceIdentifier.name);
  }, [groups, currentPage, pageSize, rulesSourceIdentifier.name]);

  return { isLoading: fetchInProgress, page: pageNamespaces, nextPage, previousPage, canMoveForward, canMoveBackward };
}

function usePrometheusGroupsGenerator(ruleSourceIdentifier: ExternalRulesSourceIdentifier, pageSize: number) {
  const prevRuleSourceIdentifier = usePrevious(ruleSourceIdentifier);
  const { prometheusGroupsGenerator } = useRuleGroupsGenerator();

  const [groupsGenerator, setGroupsGenerator] = useState<ReturnType<typeof prometheusGroupsGenerator>>(
    prometheusGroupsGenerator(ruleSourceIdentifier, pageSize)
  );

  const resetGenerator = useCallback(() => {
    setGroupsGenerator(prometheusGroupsGenerator(ruleSourceIdentifier, pageSize));
  }, [ruleSourceIdentifier, prometheusGroupsGenerator, pageSize]);

  if (prevRuleSourceIdentifier && prevRuleSourceIdentifier !== ruleSourceIdentifier) {
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
