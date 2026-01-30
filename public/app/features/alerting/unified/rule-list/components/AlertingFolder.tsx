import { useMemo, useRef, useState } from 'react';

import { Trans } from '@grafana/i18n';
import { Icon, Stack, Text } from '@grafana/ui';
import { DashboardQueryResult } from 'app/features/search/service/types';
import { GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import { GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { FolderActionsButton } from '../../components/folder-actions/FolderActionsButton';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { groups } from '../../utils/navigation';
import { GrafanaGroupLoader } from '../GrafanaGroupLoader';
import { useAlertingFolders } from '../hooks/useAlertingFolders';
import { toIndividualGroups, useFolderGroupsGenerator } from '../hooks/useFolderGroups';
import { useLazyLoadPrometheusGroups } from '../hooks/useLazyLoadPrometheusGroups';
import { FRONTED_GROUPED_PAGE_SIZE, getApiGroupPageSize } from '../paginationLimits';

import { GroupIntervalIndicator } from './GroupIntervalMetadata';
import { ListGroup } from './ListGroup';
import { ListSection } from './ListSection';
import { LoadMoreButton } from './LoadMoreButton';

interface AlertingFolderProps {
  folder: DashboardQueryResult;
  groupFilter?: string;
  namespaceFilter?: string;
}

/**
 * Component that renders a single folder containing alert rules.
 * Supports nested folders - child folders are loaded lazily when the folder is expanded.
 * Groups are also loaded lazily when the folder is expanded.
 */
export function AlertingFolder({ folder, groupFilter, namespaceFilter }: AlertingFolderProps) {
  const folderUid = folder.uid;
  const folderName = folder.name;

  // Local state for collapse/expand
  const [isOpen, setIsOpen] = useState(false);

  const apiGroupPageSize = getApiGroupPageSize(false);

  // Generator for fetching groups in this folder
  const folderGroupsGenerator = useFolderGroupsGenerator(folderUid, 0);

  const groupsGenerator = useRef(toIndividualGroups(folderGroupsGenerator(apiGroupPageSize)));

  const {
    isLoading: groupsLoading,
    groups,
    hasMoreGroups,
    fetchMoreGroups,
    error: groupsError,
  } = useLazyLoadPrometheusGroups(groupsGenerator.current, FRONTED_GROUPED_PAGE_SIZE);

  // Fetch child folders
  const {
    folders: childFolders,
    isLoading: foldersLoading,
    hasMore: hasMoreFolders,
    error: foldersError,
    fetchMore: fetchMoreFolders,
  } = useAlertingFolders({
    parentUid: folderUid,
    namespaceFilter,
  });

  // Check if folder is empty
  const hasNoContent = isOpen && childFolders.length === 0 && groups.length === 0 && !foldersLoading && !groupsLoading;

  return (
    <ListSection
      key={folderUid}
      title={
        <Stack direction="row" gap={1} alignItems="center">
          <Icon name="folder" />
          <Text variant="body" element="h3">
            {folderName}
          </Text>
        </Stack>
      }
      actions={<FolderActionsButton folderUID={folderUid} />}
      collapsed={!isOpen}
      onToggle={() => setIsOpen(!isOpen)}
      pagination={
        hasMoreFolders || hasMoreGroups ? (
          <Stack direction="column" gap={1}>
            {hasMoreFolders && (
              <div>
                <LoadMoreButton loading={foldersLoading} onClick={fetchMoreFolders} />
              </div>
            )}
            {hasMoreGroups && (
              <div>
                <LoadMoreButton loading={groupsLoading} onClick={fetchMoreGroups} />
              </div>
            )}
          </Stack>
        ) : null
      }
    >
      {/* Render child folders first (recursive) */}
      {childFolders.map((childFolder) => (
        <AlertingFolder
          key={childFolder.uid}
          folder={childFolder}
          groupFilter={groupFilter}
          namespaceFilter={namespaceFilter}
        />
      ))}

      {/* Show folder loading error */}
      {foldersError && (
        <Text color="error" variant="body">
          <Trans i18nKey="alerting.folder.failed-to-load-folders">Failed to load child folders:</Trans>{' '}
          {foldersError.message}
        </Text>
      )}

      {/* Show empty folder message */}
      {hasNoContent && (
        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="alerting.folder.empty">This folder contains no alert groups or subfolders</Trans>
        </Text>
      )}

      {/* Render alert groups */}
      {groupsError && (
        <Text color="error" variant="body">
          <Trans i18nKey="alerting.folder.failed-to-load-groups">Failed to load groups:</Trans> {groupsError.message}
        </Text>
      )}
      {groups.map((group) => (
        <GrafanaRuleGroupListItem
          key={`grafana-ns-${folderUid}-${group.name}`}
          group={group}
          namespaceName={folderName}
        />
      ))}
    </ListSection>
  );
}

export interface GrafanaRuleGroupListItemProps {
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
