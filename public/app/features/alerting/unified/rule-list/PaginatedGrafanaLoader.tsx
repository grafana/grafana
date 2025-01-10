import { groupBy } from 'lodash';
import { useEffect, useMemo, useRef } from 'react';

import { Icon, Stack, Text } from '@grafana/ui';
import { GrafanaRuleGroupIdentifier, GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';
import { GrafanaPromRuleDTO, GrafanaPromRuleGroupDTO, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { prometheusApi } from '../api/prometheusApi';
import { GrafanaRulesSource } from '../utils/datasource';

import { GrafanaRule } from './GrafanaRuleLoader';
import { RuleInTransitionListItem } from './components/AlertRuleListItem';
import { DataSourceSection } from './components/DataSourceSection';
import { LazyPagination } from './components/LazyPagination';
import { ListGroup } from './components/ListGroup';
import { ListSection } from './components/ListSection';
import { RuleGroupActionsMenu } from './components/RuleGroupActionsMenu';
import { useGrafanaGroupsGenerator } from './hooks/prometheusGroupsGenerator';
import { usePaginatedPrometheusGroups } from './hooks/usePaginatedPrometheusGroups';

const GRAFANA_GROUP_PAGE_SIZE = 40;

const { useGetGrafanaRulerGroupQuery } = alertRuleApi;
const { useGetGrafanaGroupsQuery } = prometheusApi;

export function PaginatedGrafanaLoader() {
  const grafanaGroupsGenerator = useGrafanaGroupsGenerator();

  const groupsGenerator = useRef(grafanaGroupsGenerator(GRAFANA_GROUP_PAGE_SIZE));

  useEffect(() => {
    const currentGenerator = groupsGenerator.current;
    return () => {
      currentGenerator.return();
    };
  }, []);

  const {
    page: groupsPage,
    nextPage,
    previousPage,
    canMoveForward,
    canMoveBackward,
    isLoading,
  } = usePaginatedPrometheusGroups(groupsGenerator.current, GRAFANA_GROUP_PAGE_SIZE);

  const groupsByFolder = useMemo(() => groupBy(groupsPage, 'folderUid'), [groupsPage]);

  return (
    <DataSourceSection name="Grafana" application="grafana" uid={GrafanaRulesSourceSymbol} isLoading={isLoading}>
      <Stack direction="column" gap={1}>
        {Object.entries(groupsByFolder).map(([folderUid, groups]) => {
          // Groups are grouped by folder, so we can use the first group to get the folder name
          const folderName = groups[0].file;
          return (
            <ListSection
              key={folderUid}
              title={
                <Stack direction="row" gap={1} alignItems="center">
                  <Icon name="folder" />{' '}
                  <Text variant="body" element="h3">
                    {folderName}
                  </Text>
                </Stack>
              }
            >
              {groups.map((group) => (
                <GrafanaRuleGroupListItem
                  key={`grafana-ns-${folderUid}-${group.name}`}
                  group={group}
                  namespaceName={folderName}
                />
              ))}
            </ListSection>
          );
        })}
        <LazyPagination
          nextPage={nextPage}
          previousPage={previousPage}
          canMoveForward={canMoveForward}
          canMoveBackward={canMoveBackward}
        />
      </Stack>
    </DataSourceSection>
  );
}

interface GrafanaRuleGroupListItemProps {
  group: GrafanaPromRuleGroupDTO;
  namespaceName: string;
}
export function GrafanaRuleGroupListItem({ group, namespaceName }: GrafanaRuleGroupListItemProps) {
  const groupIdentifier: GrafanaRuleGroupIdentifier = useMemo(
    () => ({
      groupName: group.name,
      namespace: {
        uid: group.folderUid,
      },
      groupOrigin: 'grafana',
    }),
    [group.name, group.folderUid]
  );

  return (
    <ListGroup
      key={group.name}
      name={group.name}
      isOpen={false}
      actions={<RuleGroupActionsMenu groupIdentifier={groupIdentifier} />}
    >
      <GrafanaGroupLoader groupIdentifier={groupIdentifier} namespaceName={namespaceName} />
      {/* {group.rules.map((rule) => {
        return (
          <GrafanaRuleLoader
            key={rule.uid}
            rule={rule}
            namespaceName={namespaceName}
            groupIdentifier={groupIdentifier}
          />
        );
      })} */}
    </ListGroup>
  );
}

interface GrafanaGroupLoaderProps {
  groupIdentifier: GrafanaRuleGroupIdentifier;
  namespaceName: string;
}

function GrafanaGroupLoader({ groupIdentifier, namespaceName }: GrafanaGroupLoaderProps) {
  const { data: promResponse } = useGetGrafanaGroupsQuery({
    folderUid: groupIdentifier.namespace.uid,
    groupName: groupIdentifier.groupName,
  });
  const { data: rulerResponse } = useGetGrafanaRulerGroupQuery({
    folderUid: groupIdentifier.namespace.uid,
    groupName: groupIdentifier.groupName,
  });

  const { matching, unmatchedPromRules, unmatchedRulerRules } = useMemo(() => {
    if (!promResponse || !rulerResponse) {
      return { matching: [], unmatchedPromRules: [], unmatchedRulerRules: [] };
    }
    return matchRules(promResponse.data.groups.at(0)?.rules ?? [], rulerResponse.rules);
  }, [promResponse, rulerResponse]);

  return (
    <>
      {unmatchedRulerRules.map((rule) => (
        <RuleInTransitionListItem
          key={rule.grafana_alert.uid}
          name={rule.grafana_alert.title}
          namespace={namespaceName}
          group={groupIdentifier.groupName}
          rulesSource={GrafanaRulesSource}
          application="grafana"
          transition="creating"
        />
      ))}
      {matching.map(({ promRule, rulerRule }) => (
        <GrafanaRule
          key={promRule.uid}
          rule={promRule}
          rulerRule={rulerRule}
          groupIdentifier={groupIdentifier}
          namespaceName={namespaceName}
        />
      ))}
      {unmatchedPromRules.map((rule) => (
        <RuleInTransitionListItem
          key={rule.uid}
          name={rule.name}
          namespace={namespaceName}
          group={groupIdentifier.groupName}
          rulesSource={GrafanaRulesSource}
          application="grafana"
          transition="deleting"
        />
      ))}
    </>
  );
}

interface RuleMatch {
  promRule: GrafanaPromRuleDTO;
  rulerRule: RulerGrafanaRuleDTO;
}

interface MatchingResult {
  matching: RuleMatch[];
  /**
   * Rules that were already removed from the Ruler but the changes has not been yet propagated to Prometheus
   */
  unmatchedPromRules: GrafanaPromRuleDTO[];
  /**
   * Rules that has been just added to the Ruler but the changes has not been yet propagated to Prometheus
   */
  unmatchedRulerRules: RulerGrafanaRuleDTO[];
}

function matchRules(promRules: GrafanaPromRuleDTO[], rulerRules: RulerGrafanaRuleDTO[]): Readonly<MatchingResult> {
  const promRulesMap = new Map(promRules.map((rule) => [rule.uid, rule]));

  const matchingResult = rulerRules.reduce<MatchingResult>(
    ({ matching, unmatchedPromRules, unmatchedRulerRules }, rulerRule) => {
      const promRule = promRulesMap.get(rulerRule.grafana_alert.uid);
      if (promRule) {
        matching.push({ promRule, rulerRule });
        promRulesMap.delete(rulerRule.grafana_alert.uid);
      } else {
        unmatchedRulerRules.push(rulerRule);
      }
      return { matching, unmatchedPromRules, unmatchedRulerRules };
    },
    { matching: [], unmatchedPromRules: [], unmatchedRulerRules: [] }
  );

  matchingResult.unmatchedPromRules.push(...promRulesMap.values());

  return matchingResult;
}
