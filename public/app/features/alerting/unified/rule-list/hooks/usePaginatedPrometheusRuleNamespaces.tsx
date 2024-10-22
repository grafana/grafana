import { compact } from 'lodash';
import { useState, useCallback, useEffect, useMemo, useDeferredValue } from 'react';
import { usePrevious } from 'react-use';

import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { PromRuleDTO, PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { groupRulesByFileName } from '../../api/prometheus';
import { prometheusApi } from '../../api/prometheusApi';
import { RulesFilter } from '../../search/rulesSearchParser';
import { labelsMatchMatchers } from '../../utils/alertmanager';
import { getDatasourceAPIUid } from '../../utils/datasource';
import { parseMatcher } from '../../utils/matchers';
import { isAlertingRule } from '../../utils/rules';

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

/**
 * Returns a new group with only the rules that match the filter.
 * @returns A new group with filtered rules, or undefined if the group does not match the filter or all rules are filtered out.
 */
function getFilteredGroup(group: PromRuleGroupDTO, filterState: RulesFilter) {
  const { name, rules, file } = group;

  // TODO Add fuzzy filtering
  if (filterState.namespace && !file.includes(filterState.namespace)) {
    return undefined;
  }

  if (filterState.groupName && !name.includes(filterState.groupName)) {
    return undefined;
  }

  const matchingRules = rules.filter((rule) => ruleMatchesFilter(rule, filterState));
  if (matchingRules.length === 0) {
    return undefined;
  }

  return { ...group, rules: matchingRules };
}

function ruleMatchesFilter(rule: PromRuleDTO, filterState: RulesFilter) {
  const { name, labels = {}, health, type } = rule;

  if (filterState.freeFormWords.length > 0 && !filterState.freeFormWords.some((word) => name.includes(word))) {
    return false;
  }
  if (filterState.ruleName && !name.includes(filterState.ruleName)) {
    return false;
  }
  if (filterState.labels.length > 0) {
    const matchers = compact(filterState.labels.map(looseParseMatcher));
    const doRuleLabelsMatchQuery = matchers.length > 0 && labelsMatchMatchers(labels, matchers);
    if (!doRuleLabelsMatchQuery) {
      return false;
    }
  }
  if (filterState.ruleType && type !== filterState.ruleType) {
    return false;
  }
  if (filterState.ruleState) {
    if (!isAlertingRule(rule)) {
      return false;
    }
    if (rule.state !== filterState.ruleState) {
      return false;
    }
  }
  if (filterState.ruleHealth && health !== filterState.ruleHealth) {
    return false;
  }

  return true;
}

function looseParseMatcher(matcherQuery: string): Matcher | undefined {
  try {
    return parseMatcher(matcherQuery);
  } catch {
    // Try to createa a matcher than matches all values for a given key
    return { name: matcherQuery, value: '', isRegex: true, isEqual: true };
  }
}
