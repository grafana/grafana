import { groupBy, isEmpty } from 'lodash';
import { useEffect, useMemo, useRef } from 'react';

import { Icon, Stack, Text } from '@grafana/ui';
import { GrafanaRuleGroupIdentifier, GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';
import { GrafanaPromRuleGroupDTO, PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { FolderActionsButton } from '../components/folder-actions/FolderActionsButton';
import { GrafanaNoRulesCTA } from '../components/rules/NoRulesCTA';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { groups } from '../utils/navigation';

import { GrafanaGroupLoader } from './GrafanaGroupLoader';
import { DataSourceSection } from './components/DataSourceSection';
import { GroupIntervalIndicator } from './components/GroupIntervalMetadata';
import { ListGroup } from './components/ListGroup';
import { ListSection } from './components/ListSection';
import { LoadMoreButton } from './components/LoadMoreButton';
import { NoRulesFound } from './components/NoRulesFound';
import { groupFilter as groupFilterFn } from './hooks/filters';
import { toIndividualRuleGroups, useGrafanaGroupsGenerator } from './hooks/prometheusGroupsGenerator';
import { useLazyLoadPrometheusGroups } from './hooks/useLazyLoadPrometheusGroups';
import { FRONTED_GROUPED_PAGE_SIZE, getApiGroupPageSize } from './paginationLimits';

interface LoaderProps {
  groupFilter?: string;
  namespaceFilter?: string;
}

export function PaginatedGrafanaLoader({ groupFilter, namespaceFilter }: LoaderProps) {
  const key = `${groupFilter}-${namespaceFilter}`;

  // Key is crucial. It resets the generator when filters change.
  return <PaginatedGroupsLoader key={key} groupFilter={groupFilter} namespaceFilter={namespaceFilter} />;
}

function PaginatedGroupsLoader({ groupFilter, namespaceFilter }: LoaderProps) {
  // If there are filters, we don't want to populate the cache to avoid performance issues
  // Filtering may trigger multiple HTTP requests, which would populate the cache with a lot of groups hurting performance
  const hasFilters = Boolean(groupFilter || namespaceFilter);

  const grafanaGroupsGenerator = useGrafanaGroupsGenerator({
    populateCache: hasFilters ? false : true,
    limitAlerts: 0,
  });

  // If there are no filters we can match one frontend page to one API page.
  // However, if there are filters, we need to fetch more groups from the API to populate one frontend page
  const apiGroupPageSize = getApiGroupPageSize(hasFilters);

  const groupsGenerator = useRef(toIndividualRuleGroups(grafanaGroupsGenerator(apiGroupPageSize)));

  useEffect(() => {
    const currentGenerator = groupsGenerator.current;
    return () => {
      currentGenerator.return();
    };
  }, []);

  const filterFn = useMemo(
    () => (group: PromRuleGroupDTO) =>
      groupFilterFn(group, {
        namespace: namespaceFilter,
        groupName: groupFilter,
      }),
    [namespaceFilter, groupFilter]
  );

  const { isLoading, groups, hasMoreGroups, fetchMoreGroups, error } = useLazyLoadPrometheusGroups(
    groupsGenerator.current,
    FRONTED_GROUPED_PAGE_SIZE,
    filterFn
  );

  const groupsByFolder = useMemo(() => groupBy(groups, 'folderUid'), [groups]);
  const hasNoRules = isEmpty(groups) && !isLoading;

  return (
    <DataSourceSection
      name="Grafana-managed"
      application="grafana"
      uid={GrafanaRulesSourceSymbol}
      isLoading={isLoading}
      error={error}
    >
      <Stack direction="column" gap={0}>
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
              actions={<FolderActionsButton folderUID={folderUid} />}
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
        {/* only show the CTA if the user has no rules and this isn't the result of a filter / search query */}
        {hasNoRules && !hasFilters && <GrafanaNoRulesCTA />}
        {hasNoRules && hasFilters && <NoRulesFound />}
        {hasMoreGroups && (
          // this div will make the button not stretch
          <div>
            <LoadMoreButton loading={isLoading} onClick={fetchMoreGroups} />
          </div>
        )}
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

  const detailsLink = groups.detailsPageLink(GRAFANA_RULES_SOURCE_NAME, group.folderUid, group.name);

  return (
    <ListGroup
      key={group.name}
      name={group.name}
      metaRight={<GroupIntervalIndicator seconds={group.interval} />}
      href={detailsLink}
      isOpen={false}
    >
      <GrafanaGroupLoader groupIdentifier={groupIdentifier} namespaceName={namespaceName} />
    </ListGroup>
  );
}
