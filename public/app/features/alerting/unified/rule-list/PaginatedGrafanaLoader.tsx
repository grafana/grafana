import { groupBy } from 'lodash';
import { useMemo, useRef } from 'react';

import { Stack, Icon, Text } from '@grafana/ui';
import { GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';

import { GrafanaRuleGroupListItem } from './PaginatedDataSourceLoader';
import { DataSourceSection } from './components/DataSourceSection';
import { LazyPagination } from './components/LazyPagination';
import { ListSection } from './components/ListSection';
import { useGrafanaGroupsGenerator } from './hooks/prometheusGroupsGenerator';
import { usePaginatedPrometheusGroups } from './hooks/usePaginatedPrometheusRuleNamespaces';

export const GROUP_PAGE_SIZE = 40;

export function PaginatedGrafanaLoader() {
  const grafanaGroupsGenerator = useGrafanaGroupsGenerator();

  const groupsGenerator = useRef(grafanaGroupsGenerator(GROUP_PAGE_SIZE));

  const {
    page: groupsPage,
    nextPage,
    previousPage,
    canMoveForward,
    canMoveBackward,
    isLoading,
  } = usePaginatedPrometheusGroups(groupsGenerator.current, GROUP_PAGE_SIZE);

  const groupsByFolder = useMemo(() => groupBy(groupsPage, 'folderUid'), [groupsPage]);

  return (
    <DataSourceSection name="Grafana" application="grafana" uid={GrafanaRulesSourceSymbol} isLoading={isLoading}>
      <Stack direction="column" gap={1}>
        {Object.entries(groupsByFolder).map(([folderUid, groups]) => (
          <ListSection
            key={folderUid}
            title={
              <Stack direction="row" gap={1} alignItems="center">
                <Icon name="folder" />{' '}
                <Text variant="body" element="h3">
                  {groups[0].file}
                </Text>
              </Stack>
            }
          >
            {groups.map((group) => (
              <GrafanaRuleGroupListItem
                key={`grafana-ns-${folderUid}-${group.name}`}
                group={group}
                namespaceName={groups[0].file}
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
