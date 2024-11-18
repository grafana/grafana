import { from } from 'ix/asynciterable/asynciterablex';
import { merge } from 'ix/asynciterable/merge';
import { filter, flatMap, take, tap } from 'ix/asynciterable/operators';
import { compact, isEqual } from 'lodash';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Skeleton from 'react-loading-skeleton';

import { Button, Card, Stack } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { DataSourceRuleGroupIdentifier } from 'app/types/unified-alerting';
import { PromRuleDTO, PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { prometheusApi } from '../api/prometheusApi';
import { isLoading, useAsync } from '../hooks/useAsync';
import { RulesFilter } from '../search/rulesSearchParser';
import { labelsMatchMatchers } from '../utils/alertmanager';
import { getDatasourceAPIUid } from '../utils/datasource';
import { parseMatcher } from '../utils/matchers';
import { hashRule } from '../utils/rule-id';
import { isAlertingRule } from '../utils/rules';

import { AlertRuleLoader } from './RuleList.v2';
import { ListItem } from './components/ListItem';
import { ActionsLoader } from './components/RuleActionsButtons.V2';
import { RuleListIcon } from './components/RuleListIcon';

interface FilterViewProps {
  filterState: RulesFilter;
}

const FRONTENT_PAGE_SIZE = 50;
const API_PAGE_SIZE = 2000;

export function FilterView({ filterState }: FilterViewProps) {
  const [prevFilterState, setPrevFilterState] = useState(filterState);
  const filterChanged = !isEqual(prevFilterState, filterState);
  const [transitionPending, startTransition] = useTransition();

  const { getFilteredRulesIterator } = useFilteredRulesIteratorProvider();

  const initIterator = useCallback(
    () => getFilteredRulesIterator(filterState).pipe(tap(undefined, undefined, () => setNoMoreResults(true))),
    [getFilteredRulesIterator, filterState]
  );

  const rulesIterator = useRef(initIterator());

  const [rules, setRules] = useState<RuleWithOrigin[]>([]);
  const [noMoreResults, setNoMoreResults] = useState(false);

  const [{ execute: loadNextPage }, state] = useAsync(async () => {
    for await (const rule of rulesIterator.current.pipe(take(FRONTENT_PAGE_SIZE))) {
      startTransition(() => {
        setRules((rules) => rules.concat(rule));
      });
    }
  });

  if (filterChanged) {
    rulesIterator.current = initIterator();
    setRules([]);
    setNoMoreResults(false);
    setPrevFilterState(filterState);
    loadNextPage();
  }

  useEffect(() => {
    loadNextPage();
  }, [loadNextPage]);

  const loading = isLoading(state) || transitionPending;

  return (
    <Stack direction="column" gap={0}>
      {rules.map(({ ruleKey, rule, groupIdentifier }) => (
        <AlertRuleLoader key={ruleKey} rule={rule} groupIdentifier={groupIdentifier} />
      ))}
      {loading ? (
        <>
          <AlertRuleListItemLoader />
          <AlertRuleListItemLoader />
          <AlertRuleListItemLoader />
        </>
      ) : noMoreResults ? (
        <Card>
          <Trans i18nKey="alerting.rule-list.filter-view.no-more-results">No more results</Trans>
        </Card>
      ) : (
        <Button onClick={loadNextPage}>
          <Trans i18nKey="alerting.rule-list.filter-view.load-more">Load more...</Trans>
        </Button>
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

function useFilteredRulesIteratorProvider() {
  const [fetchGroups] = useLazyGroupsQuery();

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

  const getFilteredRulesIterator = (filterState: RulesFilter) => {
    const [firstGenerator, ...restGenerators] = filterState.dataSourceNames.map((ds) =>
      fetchRuleSourceGroups(ds, API_PAGE_SIZE)
    );

    const groupsGenerator = merge(firstGenerator, ...restGenerators);
    return from(groupsGenerator).pipe(
      filter(([rulesSource, group]) => groupFilter(rulesSource, group, filterState)),
      flatMap(([rulesSource, group]) => mapGroupToRules(rulesSource, group)),
      filter((r) => ruleFilter(r.rule, filterState))
    );
  };

  return { getFilteredRulesIterator };
}

function mapGroupToRules(rulesSourceName: string, group: PromRuleGroupDTO): RuleWithOrigin[] {
  const groupKey = `${group.file}${group.name}`;
  return group.rules.map<RuleWithOrigin>((rule) => ({
    ruleKey: `${rulesSourceName}-${groupKey}-${hashRule(rule)}`,
    rule,
    groupIdentifier: {
      rulesSource: { name: rulesSourceName, uid: getDatasourceAPIUid(rulesSourceName) },
      namespace: { name: group.file },
      groupName: group.name,
      groupOrigin: 'datasource',
    },
  }));
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
