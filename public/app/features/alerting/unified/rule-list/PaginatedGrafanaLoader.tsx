import { groupBy, isEmpty } from 'lodash';
import { useEffect, useMemo, useRef } from 'react';

import { config } from '@grafana/runtime';
import { Icon, Stack, Text } from '@grafana/ui';
import { GrafanaRuleGroupIdentifier, GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';
import { GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { FolderBulkActionsButton } from '../components/folder-bulk-actions/FolderBulkActionsButton';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { groups } from '../utils/navigation';

import { GrafanaGroupLoader } from './GrafanaGroupLoader';
import { DataSourceSection } from './components/DataSourceSection';
import { LazyPagination } from './components/LazyPagination';
import { ListGroup } from './components/ListGroup';
import { ListSection } from './components/ListSection';
import { RuleGroupActionsMenu } from './components/RuleGroupActionsMenu';
import { toIndividualRuleGroups, useGrafanaGroupsGenerator } from './hooks/prometheusGroupsGenerator';
import { usePaginatedPrometheusGroups } from './hooks/usePaginatedPrometheusGroups';
import { GrafanaNoRulesCTA } from '../components/rules/NoRulesCTA';

const GRAFANA_GROUP_PAGE_SIZE = 40;

export function PaginatedGrafanaLoader() {
  const grafanaGroupsGenerator = useGrafanaGroupsGenerator({ populateCache: true });

  const groupsGenerator = useRef(toIndividualRuleGroups(grafanaGroupsGenerator(GRAFANA_GROUP_PAGE_SIZE)));

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

  const isFolderBulkActionsEnabled = config.featureToggles.alertingBulkActionsInUI;

  const hasNoRules = isEmpty(groupsByFolder);

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
              actions={isFolderBulkActionsEnabled ? <FolderBulkActionsButton folderUID={folderUid} /> : null}
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
        {hasNoRules && <GrafanaNoRulesCTA />}
        {!hasNoRules && (
          <LazyPagination
            nextPage={nextPage}
            previousPage={previousPage}
            canMoveForward={canMoveForward}
            canMoveBackward={canMoveBackward}
          />
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

  return (
    <ListGroup
      key={group.name}
      name={group.name}
      href={groups.detailsPageLink(GRAFANA_RULES_SOURCE_NAME, group.folderUid, group.name)}
      isOpen={false}
      actions={<RuleGroupActionsMenu groupIdentifier={groupIdentifier} />}
    >
      <GrafanaGroupLoader groupIdentifier={groupIdentifier} namespaceName={namespaceName} />
    </ListGroup>
  );
}
