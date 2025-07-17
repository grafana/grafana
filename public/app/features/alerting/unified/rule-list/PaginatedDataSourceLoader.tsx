import { groupBy, isEmpty } from 'lodash';
import { useEffect, useMemo, useRef } from 'react';

import { Icon, Stack, Text } from '@grafana/ui';
import { DataSourceRuleGroupIdentifier, DataSourceRulesSourceIdentifier, RuleGroup } from 'app/types/unified-alerting';
import { PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { groups } from '../utils/navigation';

import { DataSourceGroupLoader } from './DataSourceGroupLoader';
import { DataSourceSection, DataSourceSectionProps } from './components/DataSourceSection';
import { GroupIntervalIndicator } from './components/GroupIntervalMetadata';
import { ListGroup } from './components/ListGroup';
import { ListSection } from './components/ListSection';
import { LoadMoreButton } from './components/LoadMoreButton';
import { NoRulesFound } from './components/NoRulesFound';
import { groupFilter as groupFilterFn } from './hooks/filters';
import { toIndividualRuleGroups, usePrometheusGroupsGenerator } from './hooks/prometheusGroupsGenerator';
import { useLazyLoadPrometheusGroups } from './hooks/useLazyLoadPrometheusGroups';
import { FRONTED_GROUPED_PAGE_SIZE, getApiGroupPageSize } from './paginationLimits';

interface LoaderProps extends Required<Pick<DataSourceSectionProps, 'application'>> {
  rulesSourceIdentifier: DataSourceRulesSourceIdentifier;
  groupFilter?: string;
  namespaceFilter?: string;
}

export function PaginatedDataSourceLoader({
  rulesSourceIdentifier,
  application,
  groupFilter,
  namespaceFilter,
}: LoaderProps) {
  const key = `${rulesSourceIdentifier.uid}-${groupFilter}-${namespaceFilter}`;

  // Key is crucial. It resets the generator when filters change.
  return (
    <PaginatedGroupsLoader
      key={key}
      rulesSourceIdentifier={rulesSourceIdentifier}
      application={application}
      groupFilter={groupFilter}
      namespaceFilter={namespaceFilter}
    />
  );
}

function PaginatedGroupsLoader({ rulesSourceIdentifier, application, groupFilter, namespaceFilter }: LoaderProps) {
  // If there are filters, we don't want to populate the cache to avoid performance issues
  // Filtering may trigger multiple HTTP requests, which would populate the cache with a lot of groups hurting performance
  const hasFilters = Boolean(groupFilter || namespaceFilter);

  const { uid, name } = rulesSourceIdentifier;
  const prometheusGroupsGenerator = usePrometheusGroupsGenerator();

  // If there are no filters we can match one frontend page to one API page.
  // However, if there are filters, we need to fetch more groups from the API to populate one frontend page
  const apiGroupPageSize = getApiGroupPageSize(hasFilters);

  const groupsGenerator = useRef(
    toIndividualRuleGroups(prometheusGroupsGenerator(rulesSourceIdentifier, apiGroupPageSize))
  );

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

  const hasNoRules = isEmpty(groups) && !isLoading;
  const groupsByNamespace = useMemo(() => groupBy(groups, 'file'), [groups]);

  return (
    <DataSourceSection name={name} application={application} uid={uid} isLoading={isLoading} error={error}>
      <Stack direction="column" gap={0}>
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
        {hasMoreGroups && (
          // this div will make the button not stretch
          <div>
            <LoadMoreButton loading={isLoading} onClick={fetchMoreGroups} />
          </div>
        )}
        {hasNoRules && <NoRulesFound />}
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
      href={groups.detailsPageLink(rulesSourceIdentifier.uid, namespaceName, group.name)}
      isOpen={false}
      metaRight={<GroupIntervalIndicator seconds={group.interval} />}
    >
      <DataSourceGroupLoader groupIdentifier={groupIdentifier} expectedRulesCount={group.rules.length} />
    </ListGroup>
  );
}
