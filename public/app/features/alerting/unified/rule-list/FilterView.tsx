import { merge } from 'ix/asynciterable/merge';
import { filter, flatMap, map, take, tap, withAbort } from 'ix/asynciterable/operators';
import { compact, isEqual } from 'lodash';
import memoize from 'micro-memoize';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Skeleton from 'react-loading-skeleton';

import { Card, EmptyState, Stack } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { DataSourceRuleGroupIdentifier } from 'app/types/unified-alerting';
import { PromRuleDTO, PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { prometheusApi } from '../api/prometheusApi';
import { isLoading, useAsync } from '../hooks/useAsync';
import { RulesFilter } from '../search/rulesSearchParser';
import { labelsMatchMatchers } from '../utils/alertmanager';
import { getAllRulesSourceNames, getDatasourceAPIUid } from '../utils/datasource';
import { parseMatcher } from '../utils/matchers';
import { hashRule } from '../utils/rule-id';
import { isAlertingRule } from '../utils/rules';

import LoadMoreHelper from './LoadMoreHelper';
import { AlertRuleLoader } from './RuleList.v2';
import { ListItem } from './components/ListItem';
import { ActionsLoader } from './components/RuleActionsButtons.V2';
import { RuleListIcon } from './components/RuleListIcon';

interface FilterViewProps {
  filterState: RulesFilter;
}

const FRONTENT_PAGE_SIZE = 100;
const API_PAGE_SIZE = 2000;

export function FilterView({ filterState }: FilterViewProps) {
  const [prevFilterState, setPrevFilterState] = useState(filterState);
  const filterChanged = !isEqual(prevFilterState, filterState);
  const [transitionPending, startTransition] = useTransition();

  /* this hook returns a function that creates an AsyncIterable<RuleWithOrigin> which we will use to populate the front-end */
  const { getFilteredRulesIterator } = useFilteredRulesIteratorProvider(filterState, API_PAGE_SIZE);

  /* this is the abort controller that allows us to stop an AsyncIterable */
  const controller = useRef(new AbortController());

  /**
   * This function returs a iterator that we can use to populate the search results.
   * It also uses the signal from the AbortController above to cancel retrieving more results and sets up a
   * callback function to detect when we've exhausted the source.
   */
  const initIterator = useCallback(
    () =>
      getFilteredRulesIterator().pipe(
        withAbort(controller.current.signal),
        onFinished(() => setNoMoreResults(true))
      ),
    [getFilteredRulesIterator]
  );

  /* This is the main AsyncIterable<RuleWithOrigin> we will use for the search results */
  const rulesIterator = useRef(initIterator());

  const [rules, setRules] = useState<RuleWithOrigin[]>([]);
  const [noMoreResults, setNoMoreResults] = useState(false);

  /* This function will fetch a page of results from the iterable */
  const [{ execute: loadResultPage }, state] = useAsync(async () => {
    for await (const rule of rulesIterator.current.pipe(take(FRONTENT_PAGE_SIZE))) {
      startTransition(() => {
        setRules((rules) => rules.concat(rule));
      });
    }
  });

  /* Reset the search state, called when we choose a different filter state */
  const resetSearchState = useCallback(() => {
    // recreate abort controller
    controller.current.abort();
    controller.current = new AbortController();

    // recreate rules iterator
    rulesIterator.current = initIterator();
  }, [initIterator]);

  if (filterChanged) {
    resetSearchState();

    // reset view state
    setRules([]);
    setNoMoreResults(false);
    setPrevFilterState(filterState);

    loadResultPage();
  }

  /* Start by loading a page of results when the component mounts */
  useEffect(() => {
    loadResultPage();
  }, [loadResultPage]);

  /* When we unmount the component we make sure to abort all iterables */
  useEffect(() => {
    return () => {
      controller.current.abort();
    };
  }, [controller]);

  const loading = isLoading(state) || transitionPending;

  /* If we don't have any rules and have exhausted all sources, show a EmptyState */
  if (rules.length === 0 && noMoreResults) {
    return (
      <EmptyState variant="not-found" message="No matching rules found">
        No alert- or recording rules matched your current set of filters.
      </EmptyState>
    );
  }

  return (
    <Stack direction="column" gap={0}>
      {rules.map(({ ruleKey, rule, groupIdentifier }) => (
        <AlertRuleLoader key={ruleKey} rule={rule} groupIdentifier={groupIdentifier} />
      ))}
      {loading ? (
        <>
          <AlertRuleListItemLoader />
          <AlertRuleListItemLoader />
        </>
      ) : noMoreResults ? (
        <Card>
          <Trans i18nKey="alerting.rule-list.filter-view.no-more-results">No more results</Trans>
        </Card>
      ) : (
        <LoadMoreHelper handleLoad={loadResultPage} />
      )}
    </Stack>
  );
}

const AlertRuleListItemLoader = () => (
  <ListItem
    title={<Skeleton width={64} />}
    icon={<RuleListIcon isPaused={false} />}
    description={<Skeleton width={256} />}
    actions={<ActionsLoader />}
  />
);

const { useLazyGroupsQuery } = prometheusApi;

interface RuleWithOrigin {
  /**
   * Artificial frontend-only identifier for the rule.
   * It's used as a key for the rule in the rule list to prevent key duplication
   */
  ruleKey: string;
  rule: PromRuleDTO;
  groupIdentifier: DataSourceRuleGroupIdentifier;
}

function useFilteredRulesIteratorProvider(filterState: RulesFilter, groupLimit: number) {
  const [fetchGroups] = useLazyGroupsQuery();
  const allRuleSourceNames = getAllRulesSourceNames();

  /**
   * This async generator will continue to yield rule groups and will keep fetching backend pages as long as the consumer
   * is iterating.
   */
  const fetchRuleSourceGroups = useCallback(
    async function* (ruleSourceName: string, maxGroups: number) {
      const ruleSourceUid = getDatasourceAPIUid(ruleSourceName);

      const response = await fetchGroups({
        ruleSource: { uid: ruleSourceUid },
        groupLimit: maxGroups,
      });

      if (response.data?.data) {
        yield* response.data.data.groups.map((group) => [ruleSourceName, group] as const);
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

        if (response.data?.data) {
          yield* response.data.data.groups.map((group) => [ruleSourceName, group] as const);
        }

        lastToken = response.data?.data?.groupNextToken;
      }
    },
    [fetchGroups]
  );

  const getFilteredRulesIterator = () => {
    const ruleSourcesToFetchFrom = filterState.dataSourceNames.length
      ? filterState.dataSourceNames
      : allRuleSourceNames;
    const [source, ...iterables] = ruleSourcesToFetchFrom.map((ds) => fetchRuleSourceGroups(ds, groupLimit));

    return merge(source, ...iterables).pipe(
      filter(([rulesSource, group]) => groupFilter(rulesSource, group, filterState)),
      flatMap(([rulesSource, group]) => group.rules.map((rule) => [rulesSource, group, rule] as const)),
      filter(([_, __, rule]) => ruleFilter(rule, filterState)),
      map(([rulesSource, group, rule]) => mapRuleToRuleWithOrigin(rulesSource, group, rule))
    );
  };

  return { getFilteredRulesIterator };
}

// TODO maybe we want infinitely large?
const getRulesSourceUidMemoized = memoize(getDatasourceAPIUid, { maxSize: 10 }); // 10 is totally arbitrary value

function mapRuleToRuleWithOrigin(rulesSourceName: string, group: PromRuleGroupDTO, rule: PromRuleDTO): RuleWithOrigin {
  const ruleKey = `${rulesSourceName}-${group.file}-${group.name}-${rule.name}-${rule.type}-${hashRule(rule)}`;

  return {
    ruleKey,
    rule,
    groupIdentifier: {
      rulesSource: { name: rulesSourceName, uid: getRulesSourceUidMemoized(rulesSourceName) },
      namespace: { name: group.file },
      groupName: group.name,
      groupOrigin: 'datasource',
    },
  };
}

/**
 * Returns a new group with only the rules that match the filter.
 * @returns A new group with filtered rules, or undefined if the group does not match the filter or all rules are filtered out.
 */
function groupFilter(rulesSourceName: string, group: PromRuleGroupDTO, filterState: RulesFilter): boolean {
  const { name, file } = group;

  // TODO Add fuzzy filtering or not
  if (filterState.namespace && !file.includes(filterState.namespace)) {
    return false;
  }

  if (filterState.groupName && !name.includes(filterState.groupName)) {
    return false;
  }

  return true;
}

function ruleFilter(rule: PromRuleDTO, filterState: RulesFilter) {
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

// simple helper function to detect the end of the source async iterable
function onFinished<T>(fn: () => void) {
  return tap<T>(undefined, undefined, fn);
}
