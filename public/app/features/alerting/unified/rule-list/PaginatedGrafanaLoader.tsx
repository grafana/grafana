import { groupBy } from 'lodash';
import { useEffect, useMemo, useRef } from 'react';

import { Alert, Icon, Stack, Text } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { GrafanaRuleGroupIdentifier, GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';
import { GrafanaPromRuleDTO, GrafanaPromRuleGroupDTO, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { prometheusApi } from '../api/prometheusApi';
import { GrafanaRulesSource } from '../utils/datasource';

import { GrafanaRuleListItem } from './GrafanaRuleLoader';
import { RuleOperationListItem } from './components/AlertRuleListItem';
import { AlertRuleListItemLoader } from './components/AlertRuleListItemLoader';
import { DataSourceSection } from './components/DataSourceSection';
import { LazyPagination } from './components/LazyPagination';
import { ListGroup } from './components/ListGroup';
import { ListSection } from './components/ListSection';
import { RuleGroupActionsMenu } from './components/RuleGroupActionsMenu';
import { RuleOperation } from './components/RuleListIcon';
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
    </ListGroup>
  );
}

interface GrafanaGroupLoaderProps {
  groupIdentifier: GrafanaRuleGroupIdentifier;
  namespaceName: string;
  expectedRulesCount?: number;
}

function GrafanaGroupLoader({ groupIdentifier, namespaceName, expectedRulesCount = 3 }: GrafanaGroupLoaderProps) {
  const { data: promResponse, isLoading: isPromResponseLoading } = useGetGrafanaGroupsQuery({
    folderUid: groupIdentifier.namespace.uid,
    groupName: groupIdentifier.groupName,
  });
  const { data: rulerResponse, isLoading: isRulerGroupLoading } = useGetGrafanaRulerGroupQuery({
    folderUid: groupIdentifier.namespace.uid,
    groupName: groupIdentifier.groupName,
  });

  const { matches, promOnlyRules } = useMemo(() => {
    if (!promResponse || !rulerResponse) {
      return { matches: new Map(), promOnlyRules: [] };
    }
    return matchRules(promResponse.data.groups.at(0)?.rules ?? [], rulerResponse.rules);
  }, [promResponse, rulerResponse]);

  const isLoading = isPromResponseLoading || isRulerGroupLoading;
  if (isLoading) {
    return (
      <>
        {Array.from({ length: expectedRulesCount }).map((_, index) => (
          <AlertRuleListItemLoader key={index} />
        ))}
      </>
    );
  }

  if (!rulerResponse || !promResponse) {
    return (
      <Alert
        title={t(
          'alerting.group-loader.group-load-failed',
          'Failed to load rules from group {{ groupName }} in {{ namespaceName }}',
          { groupName: groupIdentifier.groupName, namespaceName }
        )}
        severity="error"
      />
    );
  }

  return (
    <>
      {rulerResponse.rules.map((rulerRule) => {
        const promRule = matches.get(rulerRule);

        if (!promRule) {
          return (
            <RuleOperationListItem
              key={rulerRule.grafana_alert.uid}
              name={rulerRule.grafana_alert.title}
              namespace={namespaceName}
              group={groupIdentifier.groupName}
              rulesSource={GrafanaRulesSource}
              application="grafana"
              operation={RuleOperation.Creating}
            />
          );
        }

        return (
          <GrafanaRuleListItem
            key={promRule.uid}
            rule={promRule}
            rulerRule={rulerRule}
            groupIdentifier={groupIdentifier}
            namespaceName={namespaceName}
          />
        );
      })}
      {promOnlyRules.map((rule) => (
        <RuleOperationListItem
          key={rule.uid}
          name={rule.name}
          namespace={namespaceName}
          group={groupIdentifier.groupName}
          rulesSource={GrafanaRulesSource}
          application="grafana"
          operation={RuleOperation.Deleting}
        />
      ))}
    </>
  );
}

interface MatchingResult {
  matches: Map<RulerGrafanaRuleDTO, GrafanaPromRuleDTO>;
  /**
   * Rules that were already removed from the Ruler but the changes has not been yet propagated to Prometheus
   */
  promOnlyRules: GrafanaPromRuleDTO[];
}

function matchRules(promRules: GrafanaPromRuleDTO[], rulerRules: RulerGrafanaRuleDTO[]): Readonly<MatchingResult> {
  const promRulesMap = new Map(promRules.map((rule) => [rule.uid, rule]));

  const matchingResult = rulerRules.reduce<MatchingResult>(
    (acc, rulerRule) => {
      const { matches } = acc;
      const promRule = promRulesMap.get(rulerRule.grafana_alert.uid);
      if (promRule) {
        matches.set(rulerRule, promRule);
        promRulesMap.delete(rulerRule.grafana_alert.uid);
      }
      return acc;
    },
    { matches: new Map(), promOnlyRules: [] }
  );

  matchingResult.promOnlyRules.push(...promRulesMap.values());

  return matchingResult;
}
