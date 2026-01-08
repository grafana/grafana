import { useMemo, useRef } from 'react';

import { Trans } from '@grafana/i18n';
import { Icon, Stack, Text } from '@grafana/ui';
import { DashboardQueryResult } from 'app/features/search/service/types';
import { GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import { GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { FolderActionsButton } from '../../components/folder-actions/FolderActionsButton';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { groups } from '../../utils/navigation';
import { GrafanaGroupLoader } from '../GrafanaGroupLoader';
import { toIndividualGroups, useFolderGroupsGenerator } from '../hooks/useFolderGroups';
import { useLazyLoadPrometheusGroups } from '../hooks/useLazyLoadPrometheusGroups';
import { FRONTED_GROUPED_PAGE_SIZE, getApiGroupPageSize } from '../paginationLimits';

import { GroupIntervalIndicator } from './GroupIntervalMetadata';
import { ListGroup } from './ListGroup';
import { ListSection } from './ListSection';
import { LoadMoreButton } from './LoadMoreButton';

interface AlertingFolderProps {
  folder: DashboardQueryResult;
}

/**
 * Component that renders a single folder containing alert rules.
 * Groups are loaded lazily when the folder is expanded.
 */
export function AlertingFolder({ folder }: AlertingFolderProps) {
  const folderUid = folder.uid;
  const folderName = folder.name;

  const apiGroupPageSize = getApiGroupPageSize(false);

  // Generator for fetching groups in this folder
  const folderGroupsGenerator = useFolderGroupsGenerator(folderUid, 0);

  const groupsGenerator = useRef(toIndividualGroups(folderGroupsGenerator(apiGroupPageSize)));

  const { isLoading, groups, hasMoreGroups, fetchMoreGroups, error } = useLazyLoadPrometheusGroups(
    groupsGenerator.current,
    FRONTED_GROUPED_PAGE_SIZE
  );

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
      collapsed={true}
      pagination={
        hasMoreGroups ? (
          <div>
            <LoadMoreButton loading={isLoading} onClick={fetchMoreGroups} />
          </div>
        ) : null
      }
    >
      {error && (
        <Text color="error" variant="body">
          <Trans i18nKey="alerting.folder.failed-to-load-groups">Failed to load groups:</Trans> {error.message}
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

interface GrafanaRuleGroupListItemProps {
  group: GrafanaPromRuleGroupDTO;
  namespaceName: string;
}

function GrafanaRuleGroupListItem({ group, namespaceName }: GrafanaRuleGroupListItemProps) {
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
