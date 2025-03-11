import { groupBy } from 'lodash';
import { useEffect, useMemo, useRef } from 'react';

import { Icon, Stack, Text } from '@grafana/ui';
import { GrafanaRuleGroupIdentifier, GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';
import { GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { GrafanaRuleLoader } from './GrafanaRuleLoader';
import { DataSourceSection } from './components/DataSourceSection';
import { LazyPagination } from './components/LazyPagination';
import { ListGroup } from './components/ListGroup';
import { ListSection } from './components/ListSection';
import { RuleGroupActionsMenu } from './components/RuleGroupActionsMenu';
import { useGrafanaGroupsGenerator } from './hooks/prometheusGroupsGenerator';
import { usePaginatedPrometheusGroups } from './hooks/usePaginatedPrometheusGroups';

const GRAFANA_GROUP_PAGE_SIZE = 40;

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
  const groupIdentifier: GrafanaRuleGroupIdentifier = {
    groupName: group.name,
    namespace: {
      uid: group.folderUid,
    },
    groupOrigin: 'grafana',
  };

  return (
    <ListGroup key={group.name} name={group.name} isOpen={false} actions={<RuleGroupActionsMenu />}>
      {group.rules.map((rule) => {
        return (
          <GrafanaRuleLoader
            key={rule.uid}
            rule={rule}
            namespaceName={namespaceName}
            groupIdentifier={groupIdentifier}
          />
        );
      })}
    </ListGroup>
  );
}
