import { groupBy, intersection } from 'lodash';
import { useEffect, useMemo, useRef } from 'react';

import { Alert, Icon, Stack, Text } from '@grafana/ui';
import { DataSourceRuleGroupIdentifier, DataSourceRulesSourceIdentifier, RuleGroup } from 'app/types/unified-alerting';
import { PromRuleDTO, RulerCloudRuleDTO, RulerRuleDTO, RulesSourceApplication } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { prometheusApi } from '../api/prometheusApi';
import { RULE_LIST_POLL_INTERVAL_MS } from '../utils/constants';
import { getPromRuleFingerprint, getRulerRuleFingerprint, hashRule } from '../utils/rule-id';
import { isAlertingRulerRule, isCloudRulerRule, isRecordingRulerRule } from '../utils/rules';

import { DataSourceRuleListItem } from './DataSourceRuleListItem';
import { RuleInTransitionListItem } from './components/AlertRuleListItem';
import { AlertRuleListItemLoader } from './components/AlertRuleListItemLoader';
import { DataSourceSection, DataSourceSectionProps } from './components/DataSourceSection';
import { LazyPagination } from './components/LazyPagination';
import { ListGroup } from './components/ListGroup';
import { ListSection } from './components/ListSection';
import { RuleActionsButtons } from './components/RuleActionsButtons.V2';
import { RuleGroupActionsMenu } from './components/RuleGroupActionsMenu';
import { usePrometheusGroupsGenerator } from './hooks/prometheusGroupsGenerator';
import { usePaginatedPrometheusGroups } from './hooks/usePaginatedPrometheusGroups';

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;
const { useGetGroupsQuery } = prometheusApi;
const { useGetRuleGroupForNamespaceQuery } = alertRuleApi;

const DATA_SOURCE_GROUP_PAGE_SIZE = 40;

interface PaginatedDataSourceLoaderProps extends Required<Pick<DataSourceSectionProps, 'application'>> {
  rulesSourceIdentifier: DataSourceRulesSourceIdentifier;
}

export function PaginatedDataSourceLoader({ rulesSourceIdentifier, application }: PaginatedDataSourceLoaderProps) {
  const { uid, name } = rulesSourceIdentifier;
  const prometheusGroupsGenerator = usePrometheusGroupsGenerator();

  const groupsGenerator = useRef(prometheusGroupsGenerator(rulesSourceIdentifier, DATA_SOURCE_GROUP_PAGE_SIZE));

  useEffect(() => {
    const currentGenerator = groupsGenerator.current;
    return () => {
      currentGenerator.return();
    };
  }, [groupsGenerator]);

  const {
    page: groupsPage,
    nextPage,
    previousPage,
    canMoveForward,
    canMoveBackward,
    isLoading,
  } = usePaginatedPrometheusGroups(groupsGenerator.current, DATA_SOURCE_GROUP_PAGE_SIZE);

  const groupsByNamespace = useMemo(() => groupBy(groupsPage, 'file'), [groupsPage]);

  return (
    <DataSourceSection name={name} application={application} uid={uid} isLoading={isLoading}>
      <Stack direction="column" gap={1}>
        {Object.entries(groupsByNamespace).map(([namespace, groups]) => (
          <ListSection
            key={namespace}
            title={
              <Stack direction="row" gap={1} alignItems="center">
                <Icon name="folder" />{' '}
                <Text variant="body" element="h3">
                  {namespace}
                </Text>
              </Stack>
            }
          >
            {groups.map((group) => (
              <RuleGroupListItem
                key={`${rulesSourceIdentifier.uid}-${namespace}-${group.name}`}
                group={group}
                rulesSourceIdentifier={rulesSourceIdentifier}
                namespaceName={namespace}
              />
            ))}
          </ListSection>
        ))}
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

interface RuleGroupListItemProps {
  group: RuleGroup;
  rulesSourceIdentifier: DataSourceRulesSourceIdentifier;
  namespaceName: string;
}

function RuleGroupListItem({ rulesSourceIdentifier, group, namespaceName }: RuleGroupListItemProps) {
  const groupIdentifier: DataSourceRuleGroupIdentifier = useMemo(
    () => ({
      rulesSource: rulesSourceIdentifier,
      namespace: { name: namespaceName },
      groupName: group.name,
      groupOrigin: 'datasource',
    }),
    [rulesSourceIdentifier, namespaceName, group.name]
  );

  return (
    <ListGroup
      key={group.name}
      name={group.name}
      isOpen={false}
      actions={<RuleGroupActionsMenu groupIdentifier={groupIdentifier} />}
    >
      <DataSourceGroupLoader
        groupIdentifier={groupIdentifier}
        namespaceName={namespaceName}
        groupName={group.name}
        expectedRulesCount={group.rules.length}
      />
    </ListGroup>
  );
}

interface DataSourceGroupLoaderProps {
  groupIdentifier: DataSourceRuleGroupIdentifier;
  namespaceName: string;
  groupName: string;
  expectedRulesCount?: number;
}

function DataSourceGroupLoader({
  groupIdentifier,
  namespaceName,
  groupName,
  expectedRulesCount = 3,
}: DataSourceGroupLoaderProps) {
  const {
    data: promResponse,
    isLoading: isPromResponseLoading,
    isError: isPromResponseError,
  } = useGetGroupsQuery(
    {
      ruleSource: groupIdentifier.rulesSource,
      namespace: namespaceName,
      groupName: groupName,
    },
    { pollingInterval: RULE_LIST_POLL_INTERVAL_MS }
  );

  const {
    data: dsFeatures,
    isLoading: isDsFeaturesLoading,
    isError: isDsFeaturesError,
  } = useDiscoverDsFeaturesQuery({
    uid: groupIdentifier.rulesSource.uid,
  });

  const {
    data: rulerGroup,
    isLoading: isRulerGroupLoading,
    isError: isRulerGroupError,
  } = useGetRuleGroupForNamespaceQuery(
    {
      rulerConfig: dsFeatures?.rulerConfig!,
      namespace: namespaceName,
      group: groupName,
    },
    { skip: !dsFeatures?.rulerConfig }
  );

  const isLoading = isPromResponseLoading || isDsFeaturesLoading || isRulerGroupLoading;
  if (isLoading) {
    return (
      <>
        {Array.from({ length: expectedRulesCount }).map((_, index) => (
          <AlertRuleListItemLoader key={index} />
        ))}
      </>
    );
  }

  const isError = isPromResponseError || isDsFeaturesError || isRulerGroupError;
  if (isError) {
    return <Alert title="Failed to load rules group" severity="error" />;
  }

  const promGroup = promResponse?.data.groups.find((g) => g.file === namespaceName && g.name === groupName);
  if (dsFeatures?.rulerConfig && rulerGroup && promGroup) {
    // There should be always only one group in the response but some Prometheus-compatible data sources
    // implement different filter parameters

    return (
      <RulerEnabledDataSourceGroupLoader
        groupIdentifier={groupIdentifier}
        namespaceName={namespaceName}
        groupName={groupName}
        promRules={promGroup.rules}
        // Filter is just for typescript. We should never have other rule type in this component
        // Grafana rules are handled in a different component
        rulerRules={rulerGroup.rules.filter(isCloudRulerRule)}
        application={dsFeatures.application}
      />
    );
  }

  // Data source without ruler
  if (promGroup) {
    return (
      <>
        {promGroup.rules.map((rule) => (
          <DataSourceRuleListItem
            key={hashRule(rule)}
            rule={rule}
            groupIdentifier={groupIdentifier}
            application={dsFeatures?.application}
          />
        ))}
      </>
    );
  }

  // This should never happen
  return <Alert title="Cannot find rules for this group" severity="warning" />;
}

interface RulerEnabledDataSourceGroupLoaderProps extends DataSourceGroupLoaderProps {
  promRules: PromRuleDTO[];
  rulerRules: RulerCloudRuleDTO[];
  application: RulesSourceApplication;
}

function RulerEnabledDataSourceGroupLoader({
  groupIdentifier,
  namespaceName,
  groupName,
  application,
  promRules,
  rulerRules,
}: RulerEnabledDataSourceGroupLoaderProps) {
  const { matching, unmatchedPromRules, unmatchedRulerRules } = useMemo(() => {
    return matchRules(promRules, rulerRules);
  }, [promRules, rulerRules]);

  return (
    <>
      {unmatchedRulerRules.map((rule) => (
        <RuleInTransitionListItem
          key={getRuleName(rule)}
          name={getRuleName(rule)}
          namespace={namespaceName}
          group={groupName}
          rulesSource={groupIdentifier.rulesSource}
          application={application}
          transition="creating"
        />
      ))}
      {matching.map(({ promRule, rulerRule }) => (
        <DataSourceRuleListItem
          key={hashRule(promRule)}
          rule={promRule}
          rulerRule={rulerRule}
          groupIdentifier={groupIdentifier}
          application={application}
          actions={
            <RuleActionsButtons rule={rulerRule} promRule={promRule} groupIdentifier={groupIdentifier} compact />
          }
        />
      ))}
      {unmatchedPromRules.map((rule) => (
        <RuleInTransitionListItem
          key={rule.name}
          name={rule.name}
          namespace={namespaceName}
          group={groupName}
          rulesSource={groupIdentifier.rulesSource}
          application={application}
          transition="deleting"
        />
      ))}
    </>
  );
}

function getRuleName(rule: RulerRuleDTO): string {
  if (isAlertingRulerRule(rule)) {
    return rule.alert;
  }
  if (isRecordingRulerRule(rule)) {
    return rule.record;
  }
  return '';
}

interface RuleMatch {
  promRule: PromRuleDTO;
  rulerRule: RulerRuleDTO;
}

interface MatchingResult {
  matching: RuleMatch[];
  unmatchedPromRules: PromRuleDTO[];
  unmatchedRulerRules: RulerRuleDTO[];
}

export function matchRules(promRules: PromRuleDTO[], rulerRules: RulerCloudRuleDTO[]): MatchingResult {
  const promRulesByHashWithQuery = new Map(promRules.map((rule) => [getPromRuleIdentifier(rule, true), rule]));
  const promRulesByHashWithoutQuery = new Map(promRules.map((rule) => [getPromRuleIdentifier(rule, false), rule]));

  const matchingResult = rulerRules.reduce<MatchingResult>(
    (acc, rulerRule) => {
      const { matching, unmatchedRulerRules } = acc;

      // We try to match including the query first, if it fails we try without it
      const rulerBasedIdentifier = getRulerRuleIdentifier(rulerRule, true);
      const promRuleMatchedWithQuery = promRulesByHashWithQuery.get(rulerBasedIdentifier);

      if (promRuleMatchedWithQuery) {
        matching.push({ promRule: promRuleMatchedWithQuery, rulerRule });
        promRulesByHashWithQuery.delete(rulerBasedIdentifier);
        return acc;
      }

      const rulerBasedIdentifierWithoutQuery = getRulerRuleIdentifier(rulerRule, false);
      const promRuleMatchedWithoutQuery = promRulesByHashWithoutQuery.get(rulerBasedIdentifierWithoutQuery);

      if (promRuleMatchedWithoutQuery) {
        matching.push({ promRule: promRuleMatchedWithoutQuery, rulerRule });
        promRulesByHashWithoutQuery.delete(rulerBasedIdentifierWithoutQuery);
        return acc;
      }

      unmatchedRulerRules.push(rulerRule);
      return acc;
    },
    { matching: [], unmatchedPromRules: [], unmatchedRulerRules: [] }
  );

  // Truly unmatched rules are the ones which are still present in both maps
  const unmatchedPromRules = intersection(
    Array.from(promRulesByHashWithQuery.values()),
    Array.from(promRulesByHashWithoutQuery.values())
  );

  return { ...matchingResult, unmatchedPromRules };
}

function getPromRuleIdentifier(rule: PromRuleDTO, includeQuery: boolean): string {
  return getPromRuleFingerprint(rule, includeQuery).join('-');
}

function getRulerRuleIdentifier(rule: RulerCloudRuleDTO, includeQuery: boolean): string {
  return getRulerRuleFingerprint(rule, includeQuery).join('-');
}
