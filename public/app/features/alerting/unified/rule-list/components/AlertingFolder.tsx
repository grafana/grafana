import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { useGetFolderParentsQuery } from 'app/api/clients/folder/v1beta1';
import { Breadcrumbs } from 'app/core/components/Breadcrumbs/Breadcrumbs';
import { Breadcrumb } from 'app/core/components/Breadcrumbs/types';
import kbn from 'app/core/utils/kbn';
import { DashboardQueryResult } from 'app/features/search/service/types';

import { FolderActionsButton } from '../../components/folder-actions/FolderActionsButton';
import { useAlertingFolders } from '../hooks/useAlertingFolders';
import { useFolderRulesPagination } from '../hooks/useFolderRulesPagination';

import { FolderRuleListItem } from './FolderRuleListItem';
import { ListSection } from './ListSection';
import { LoadMoreButton } from './LoadMoreButton';
import { RuleGroupContainer } from './RuleGroupContainer';

interface AlertingFolderProps {
  folder: DashboardQueryResult;
  groupFilter?: string;
  namespaceFilter?: string;
}

/**
 * Builds a folder URL from UID and title
 * Mimics backend logic for folder URL generation
 */
function getFolderUrl(uid: string, title: string): string {
  const slug = kbn.slugifyForUrl(title);
  return `${config.appSubUrl}/dashboards/f/${uid}/${slug}`;
}

/**
 * Component that renders a single folder containing alert rules.
 * Supports nested folders - child folders are loaded lazily when the folder is expanded.
 * Rules are displayed in lightweight group containers with folder-level pagination.
 */
export function AlertingFolder({ folder, groupFilter, namespaceFilter }: AlertingFolderProps) {
  const folderUid = folder.uid;
  const folderName = folder.name;
  const styles = useStyles2(getStyles);

  // Local state for collapse/expand
  const [isOpen, setIsOpen] = useState(false);

  // Fetch parent data (will use prefetched cache from useAlertingFolders)
  const { data: parentsData, isLoading: parentsLoading } = useGetFolderParentsQuery({ name: folderUid });

  // Transform parent data to breadcrumbs
  const breadcrumbs = useMemo((): Breadcrumb[] => {
    const items = parentsData?.items ?? [];

    // Convert parents to breadcrumbs (excluding current folder)
    const parentBreadcrumbs = items
      .filter((parent) => parent.name !== folderUid)
      .map((parent) => ({
        text: parent.title,
        href: getFolderUrl(parent.name, parent.title),
      }));

    // Add current folder as last item
    return [
      ...parentBreadcrumbs,
      {
        text: folderName,
        href: getFolderUrl(folderUid, folderName),
      },
    ];
  }, [parentsData, folderUid, folderName]);

  // Fetch rules with folder-level pagination
  const {
    rulesByGroup,
    hasMore: hasMoreRules,
    loadMore: loadMoreRules,
    isLoading: rulesLoading,
    error: rulesError,
    visibleRulesCount,
  } = useFolderRulesPagination({
    folderUid,
    pageSize: 40,
  });

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
  const hasNoContent =
    isOpen && childFolders.length === 0 && visibleRulesCount === 0 && !foldersLoading && !rulesLoading;

  return (
    <ListSection
      key={folderUid}
      title={
        <Stack direction="row" gap={1} alignItems="center">
          <Icon name="folder" />
          <Stack direction="column" gap={0.25}>
            {/* Folder title */}
            <Text variant="body" element="h3">
              {folderName}
            </Text>

            {/* Breadcrumbs below in smaller font - only if folder has parents */}
            {breadcrumbs.length > 1 && !parentsLoading && (
              <div className={styles.breadcrumbsWrapper}>
                <Breadcrumbs breadcrumbs={breadcrumbs} />
              </div>
            )}
          </Stack>
        </Stack>
      }
      actions={<FolderActionsButton folderUID={folderUid} />}
      collapsed={!isOpen}
      onToggle={() => setIsOpen(!isOpen)}
      pagination={
        hasMoreFolders || hasMoreRules ? (
          <Stack direction="column" gap={1}>
            {hasMoreFolders && (
              <div>
                <LoadMoreButton loading={foldersLoading} onClick={fetchMoreFolders} />
              </div>
            )}
            {hasMoreRules && (
              <div>
                <LoadMoreButton loading={rulesLoading} onClick={loadMoreRules} />
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

      {/* Show rules loading error */}
      {rulesError && (
        <Text color="error" variant="body">
          <Trans i18nKey="alerting.folder.failed-to-load-groups">Failed to load rules:</Trans> {rulesError.message}
        </Text>
      )}

      {/* Render rules in lightweight group containers */}
      {Array.from(rulesByGroup.entries()).map(([groupName, rulesInGroup]) => (
        <RuleGroupContainer key={groupName} groupName={groupName}>
          {rulesInGroup.map(({ rule, group }) => (
            <FolderRuleListItem key={rule.uid} rule={rule} group={group} namespaceName={folderName} />
          ))}
        </RuleGroupContainer>
      ))}
    </ListSection>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  breadcrumbsWrapper: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
});
