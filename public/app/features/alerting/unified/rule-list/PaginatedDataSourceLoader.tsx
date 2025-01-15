import { groupBy } from 'lodash';
import { useEffect, useMemo, useRef } from 'react';

import { Icon, Stack, Text } from '@grafana/ui';
import { DataSourceRuleGroupIdentifier, DataSourceRulesSourceIdentifier, RuleGroup } from 'app/types/unified-alerting';

import { hashRule } from '../utils/rule-id';

import { DataSourceRuleLoader } from './DataSourceRuleLoader';
import { DataSourceSection, DataSourceSectionProps } from './components/DataSourceSection';
import { LazyPagination } from './components/LazyPagination';
import { ListGroup } from './components/ListGroup';
import { ListSection } from './components/ListSection';
import { RuleGroupActionsMenu } from './components/RuleGroupActionsMenu';
import { usePrometheusGroupsGenerator } from './hooks/prometheusGroupsGenerator';
import { usePaginatedPrometheusGroups } from './hooks/usePaginatedPrometheusGroups';

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
  const rulesWithGroupId = useMemo(() => {
    return group.rules.map((rule) => {
      const groupIdentifier: DataSourceRuleGroupIdentifier = {
        rulesSource: rulesSourceIdentifier,
        namespace: { name: namespaceName },
        groupName: group.name,
        groupOrigin: 'datasource',
      };
      return { rule, groupIdentifier };
    });
  }, [group, namespaceName, rulesSourceIdentifier]);

  return (
    <ListGroup key={group.name} name={group.name} isOpen={false} actions={<RuleGroupActionsMenu />}>
      {rulesWithGroupId.map(({ rule, groupIdentifier }) => (
        <DataSourceRuleLoader key={hashRule(rule)} rule={rule} groupIdentifier={groupIdentifier} />
      ))}
    </ListGroup>
  );
}
