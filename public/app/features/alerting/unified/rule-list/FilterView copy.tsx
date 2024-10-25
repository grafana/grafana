import { compact } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button, Card, Stack } from '@grafana/ui';
import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';
import { PromRuleGroupDTO, PromRuleDTO } from 'app/types/unified-alerting-dto';

import { prometheusApi } from '../api/prometheusApi';
import { useAsync } from '../hooks/useAsync';
import { RulesFilter } from '../search/rulesSearchParser';
import { labelsMatchMatchers } from '../utils/alertmanager';
import { getDatasourceAPIUid } from '../utils/datasource';
import { parseMatcher } from '../utils/matchers';
import { isAlertingRule } from '../utils/rules';

interface FilterViewProps {
  filterState: RulesFilter;
}

export function FilterView({ filterState }: FilterViewProps) {
  const { getFilteredRulesIterator } = usePaginatedFilteredRules();

  const rulesIterator = getFilteredRulesIterator(filterState);

  const [rules, setRules] = useState<RuleWithOrigin[]>([]);
  // const [rulesLimit, setRulesLimit] = useState(20);

  const [{ execute: loadNextPage }, state] = useAsync(async () => {
    const pageSize = 20;
    let currentRules = 0;

    while (currentRules < pageSize) {
      const { value, done } = await rulesIterator.next();
      if (done) {
        break;
      }
      setRules((prev) => [...prev, value]);
      currentRules++;
    }
  });

  // if (rules.length < rulesLimit && state.status !== 'loading') {
  //   loadNextPage();
  // }
  useEffect(() => {
    loadNextPage();
  }, [loadNextPage]);

  return (
    <Stack direction="column" gap={1}>
      {rules.map((rule) => (
        <Card key={rule.rule.name}>{rule.rule.name}</Card>
      ))}
      <Button onClick={loadNextPage} disabled={state.status === 'loading'}>
        Load more...
      </Button>
      {/* Filter view content will be implemented here */}
    </Stack>
  );
}

const { useLazyGroupsQuery } = prometheusApi;

interface RuleWithOrigin {
  rule: PromRuleDTO;
  groupIdentifier: RuleGroupIdentifier;
}

interface GroupWithIdentifier extends PromRuleGroupDTO {
  identifier: RuleGroupIdentifier;
}

function usePaginatedFilteredRules() {
  const [fetchGroups] = useLazyGroupsQuery();

  const getGroups = useCallback(
    async function* (ruleSourceNames: string[], maxGroups: number) {
      // TODO Filter by only selected rule sources
      const ruleSourceUids = ruleSourceNames.map(getDatasourceAPIUid);

      const pageRequestsQueue: Array<{ ruleSourceUid: string; nextToken: string }> = [];

      const initRequests = ruleSourceUids.map((ruleSourceUid) =>
        fetchGroups({
          ruleSource: { uid: ruleSourceUid },
          maxGroups,
        })
      );

      for await (const initReqponse of initRequests) {
        if (!initReqponse.data?.data) {
          continue;
        }

        yield* initReqponse.data.data.groups.map((group) =>
          mapGroupToGroupWithIdentifier(group, initReqponse.originalArgs.ruleSource.uid)
        );

        let lastToken: string | undefined = undefined;
        if (initReqponse.data?.data?.nextToken) {
          lastToken = initReqponse.data.data.nextToken;
          pageRequestsQueue.push({ ruleSourceUid: initReqponse.originalArgs.ruleSource.uid, nextToken: lastToken });
        }

        // while (lastToken) {
        //   const response = await fetchGroups({
        //     ruleSource: { uid: initReqponse.originalArgs.ruleSource.uid },
        //     nextToken: lastToken,
        //     maxGroups,
        //   });

        //   if (response.data?.data) {
        //     yield* response.data.data.groups.map((group) =>
        //       mapGroupToGroupWithIdentifier(group, initReqponse.originalArgs.ruleSource.uid)
        //     );
        //   }

        //   lastToken = response.data?.data?.nextToken;
        // }
      }

      while (pageRequestsQueue.length > 0) {
        const { ruleSourceUid, nextToken } = pageRequestsQueue.shift()!;
        const response = await fetchGroups({
          ruleSource: { uid: ruleSourceUid },
          nextToken,
          maxGroups,
        });

        if (response.data?.data) {
          yield* response.data.data.groups.map((group) => mapGroupToGroupWithIdentifier(group, ruleSourceUid));
        }

        if (response.data?.data?.nextToken) {
          pageRequestsQueue.push({ ruleSourceUid, nextToken: response.data.data.nextToken });
        }
      }

      // for (const ruleSourceUid of ruleSourceUids) {
      //   const response = await fetchGroups({
      //     ruleSource: { uid: ruleSourceUid },
      //     maxGroups,
      //   });

      //   if (response.data?.data) {
      //     yield* response.data.data.groups.map((group) => mapGroupToGroupWithIdentifier(group, ruleSourceUid));
      //   }

      //   let lastToken: string | undefined = undefined;
      //   if (response.data?.data?.nextToken) {
      //     lastToken = response.data.data.nextToken;
      //   }

      //   while (lastToken) {
      //     const response = await fetchGroups({
      //       ruleSource: { uid: ruleSourceUid },
      //       nextToken: lastToken,
      //       maxGroups,
      //     });

      //     if (response.data?.data) {
      //       yield* response.data.data.groups.map((group) => mapGroupToGroupWithIdentifier(group, ruleSourceUid));
      //     }

      //     lastToken = response.data?.data?.nextToken;
      //   }
      // }
    },
    [fetchGroups]
  );

  // const groupsGenerator = useRef<AsyncGenerator<GroupWithIdentifier, void, undefined> | undefined>(
  //   getGroups(filterState.dataSourceNames, 100)
  // );

  const getFilteredRules = useCallback(async function* (
    groupsIterator: AsyncGenerator<GroupWithIdentifier, void, undefined>,
    filter: RulesFilter
  ): AsyncGenerator<RuleWithOrigin, void, undefined> {
    for await (const group of groupsIterator) {
      const filteredGroup = getFilteredGroup(group, filter);
      if (filteredGroup) {
        const filteredRules = mapGroupToRules(filteredGroup);
        yield* filteredRules;
      }
    }
  }, []);

  // const rulesGenerator = useRef<AsyncGenerator<RuleWithOrigin, void, undefined> | undefined>(getFilteredRules(filterState));

  const getFilteredRulesIterator = (filter: RulesFilter) => {
    const groupsIterator = getGroups(filter.dataSourceNames, 500);
    const rulesIterator = getFilteredRules(groupsIterator, filter);

    return rulesIterator;
  };

  return { getFilteredRulesIterator };
}

function mapGroupToRules(group: GroupWithIdentifier): RuleWithOrigin[] {
  return group.rules.map<RuleWithOrigin>((rule) => ({
    rule,
    groupIdentifier: group.identifier,
  }));
}

function mapGroupToGroupWithIdentifier(group: PromRuleGroupDTO, ruleSourceName: string): GroupWithIdentifier {
  return {
    ...group,
    identifier: {
      dataSourceName: ruleSourceName,
      namespaceName: group.file,
      groupName: group.name,
    },
  };
}

/**
 * Returns a new group with only the rules that match the filter.
 * @returns A new group with filtered rules, or undefined if the group does not match the filter or all rules are filtered out.
 */
function getFilteredGroup<T extends PromRuleGroupDTO>(group: T, filterState: RulesFilter): T | undefined {
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
