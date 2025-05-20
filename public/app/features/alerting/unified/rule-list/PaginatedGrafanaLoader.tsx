import { groupBy } from 'lodash';
import { useEffect, useMemo, useRef } from 'react';

import { Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Icon, LinkButton, Stack, Text } from '@grafana/ui';
import { GrafanaRuleGroupIdentifier, GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';
import { GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { FolderBulkActionsButton } from '../components/folder-actions/FolderActionsButton';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { makeFolderLink } from '../utils/misc';
import { groups } from '../utils/navigation';

import { GrafanaGroupLoader } from './GrafanaGroupLoader';
import { DataSourceSection } from './components/DataSourceSection';
import { ListGroup } from './components/ListGroup';
import { ListSection } from './components/ListSection';
import { LoadMoreButton } from './components/LoadMoreButton';
import { toIndividualRuleGroups, useGrafanaGroupsGenerator } from './hooks/prometheusGroupsGenerator';
import { useLazyLoadPrometheusGroups } from './hooks/useLazyLoadPrometheusGroups';

export const GRAFANA_GROUP_PAGE_SIZE = 40;

export function PaginatedGrafanaLoader() {
  const grafanaGroupsGenerator = useGrafanaGroupsGenerator({ populateCache: true });

  const groupsGenerator = useRef(toIndividualRuleGroups(grafanaGroupsGenerator(GRAFANA_GROUP_PAGE_SIZE)));

  useEffect(() => {
    const currentGenerator = groupsGenerator.current;
    return () => {
      currentGenerator.return();
    };
  }, []);

  const { isLoading, groups, hasMoreGroups, fetchMoreGroups } = useLazyLoadPrometheusGroups(
    groupsGenerator.current,
    GRAFANA_GROUP_PAGE_SIZE
  );

  const groupsByFolder = useMemo(() => groupBy(groups, 'folderUid'), [groups]);

  const isFolderBulkActionsEnabled = config.featureToggles.alertingBulkActionsInUI;

  return (
    <DataSourceSection name="Grafana" application="grafana" uid={GrafanaRulesSourceSymbol} isLoading={isLoading}>
      <Stack direction="column" gap={0}>
        {Object.entries(groupsByFolder).map(([folderUid, groups]) => {
          // Groups are grouped by folder, so we can use the first group to get the folder name
          const folderName = groups[0].file;
          const folderUrl = makeFolderLink(folderUid);

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
              actions={
                <>
                  <LinkButton variant="secondary" fill="text" size="sm" href={folderUrl}>
                    <Trans i18nKey="alerting.folder-bulk-actions.view.folder">View folder</Trans>
                  </LinkButton>
                  {isFolderBulkActionsEnabled ? <FolderBulkActionsButton folderUID={folderUid} /> : null}
                </>
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
        {hasMoreGroups && (
          // this div will make the button not stretch
          <div>
            <LoadMoreButton onClick={fetchMoreGroups} />
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

  return (
    <ListGroup
      key={group.name}
      name={group.name}
      href={groups.detailsPageLink(GRAFANA_RULES_SOURCE_NAME, group.folderUid, group.name)}
      isOpen={false}
    >
      <GrafanaGroupLoader groupIdentifier={groupIdentifier} namespaceName={namespaceName} />
    </ListGroup>
  );
}
