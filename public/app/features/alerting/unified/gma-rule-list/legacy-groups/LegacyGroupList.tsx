import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Box, EmptyState, LoadingBar, Text, useStyles2 } from '@grafana/ui';
import { useSelector } from 'app/types/store';
import { type GrafanaPromRuleGroupDTO, PromRuleType } from 'app/types/unified-alerting-dto';

import { FolderListRow } from '../folder-browsing/FolderListRow';
import { RuleListSkeleton } from '../rule-row/RuleListSkeleton';
import { RuleRowList } from '../rule-row/RuleRowList';
import { InlineRequestError } from '../shared/InlineRequestError';
import { PagedFailureAlert } from '../shared/PagedFailureAlert';

import { ConvertGroupDrawer } from './ConvertGroupDrawer';
import { FitToWindowVirtualList } from './FitToWindowVirtualList';
import { LegacyGroupRow } from './LegacyGroupRow';
import {
  type LegacyGroupsListingArg,
  type LegacyGroupsPage,
  legacyGroupsAPI,
  splitFolderPath,
  useLegacyGroupsListingInfiniteQuery,
} from './legacyGroupsApi';

// LoadingBar's width only sets its animation speed.
const LOADING_BAR_WIDTH = 1000;

interface LegacyGroupListProps {
  search: LegacyGroupsListingArg;
}

/** The legacy groups for one search, by folder. Mount it keyed by the search, so its state resets with it. */
export function LegacyGroupList({ search }: LegacyGroupListProps) {
  const styles = useStyles2(getStyles);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Here rather than in the row: a row scrolled out of the virtual window unmounts.
  const [converting, setConverting] = useState<{ group: GrafanaPromRuleGroupDTO; folderPath: string[] }>();
  const [createdFolders, setCreatedFolders] = useState<Record<string, string>>({});

  // currentData, not data: data still holds the previous search's result while a new one loads.
  const { currentData, isFetching, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } =
    useLegacyGroupsListingInfiniteQuery(search);

  // The hook's types leave this flag out.
  const selectListing = useMemo(() => legacyGroupsAPI.endpoints.legacyGroupsListing.select(search), [search]);
  const { isFetchNextPageError } = useSelector(selectListing);

  const folders = useMemo(() => groupByFolder(currentData?.pages ?? []), [currentData]);
  const rows = useMemo(() => toListRows(folders, expanded), [folders, expanded]);

  const reloading = isFetching && !isFetchingNextPage && Boolean(currentData);
  const loadMore = hasNextPage && !isFetching && !isError ? fetchNextPage : undefined;

  const toggle = (uid: string) => {
    setExpanded((prev) => {
      const updated = new Set(prev);
      if (!updated.delete(uid)) {
        updated.add(uid);
      }
      return updated;
    });
  };

  const onDrawerClose = (groupChanged: boolean) => {
    setConverting(undefined);
    if (groupChanged) {
      void refetch();
    }
  };

  if (!currentData) {
    return isError ? (
      <InlineRequestError
        title={t('alerting.gma-rule-list.legacy-groups.groups-error', 'Failed to load groups')}
        error={error}
        onRetry={() => void refetch()}
      />
    ) : (
      <RuleListSkeleton />
    );
  }

  return (
    <>
      {folders.length === 0 && !hasNextPage ? (
        <EmptyResult search={search} />
      ) : (
        <div className={styles.listArea}>
          {reloading && (
            <div className={styles.loadingBar}>
              <LoadingBar width={LOADING_BAR_WIDTH} />
            </div>
          )}
          <FitToWindowVirtualList
            items={rows}
            getKey={(row) => row.key}
            renderItem={(row) => <ListRowContent row={row} onToggle={toggle} onConvert={setConverting} />}
            onEndReached={loadMore}
            aria-label={t('alerting.gma-rule-list.legacy-groups.list-label', 'Legacy groups by folder')}
            footer={
              <>
                {isFetchingNextPage && <RuleListSkeleton />}
                {isError && (
                  <PagedFailureAlert
                    failure={{ kind: isFetchNextPageError ? 'load-more' : 'refresh', error }}
                    onRetry={() => void (isFetchNextPageError ? fetchNextPage() : refetch())}
                  />
                )}
              </>
            }
          />
        </div>
      )}
      {converting && (
        <ConvertGroupDrawer
          group={converting.group}
          folderPath={converting.folderPath}
          createdFolderUid={createdFolders[groupKey(converting.group)]}
          onFolderCreated={(uid) => setCreatedFolders((prev) => ({ ...prev, [groupKey(converting.group)]: uid }))}
          onClose={onDrawerClose}
        />
      )}
    </>
  );
}

interface LegacyGroupsFolder {
  uid: string;
  /** Titles from the outermost folder down to this one. */
  path: string[];
  groups: GrafanaPromRuleGroupDTO[];
}

type ListRow =
  | { key: string; folder: LegacyGroupsFolder; open: boolean }
  | { key: string; folder: LegacyGroupsFolder; group: GrafanaPromRuleGroupDTO };

interface ListRowContentProps {
  row: ListRow;
  onToggle: (folderUid: string) => void;
  onConvert: (target: { group: GrafanaPromRuleGroupDTO; folderPath: string[] }) => void;
}

function ListRowContent({ row, onToggle, onConvert }: ListRowContentProps) {
  if ('group' in row) {
    return (
      <Box paddingLeft={2.5}>
        <RuleRowList>
          <LegacyGroupRow
            group={row.group}
            onConvert={() => onConvert({ group: row.group, folderPath: row.folder.path })}
          />
        </RuleRowList>
      </Box>
    );
  }
  return (
    <RuleRowList>
      <FolderListRow
        folderUid={row.folder.uid}
        title={row.folder.path.at(-1) ?? row.folder.uid}
        parents={row.folder.path.slice(0, -1)}
        count={
          <Text color="secondary" variant="bodySmall">
            {t('alerting.gma-rule-list.legacy-groups.folder-group-count', '', {
              count: row.folder.groups.length,
              defaultValue_one: '{{count}} group',
              defaultValue_other: '{{count}} groups',
            })}
          </Text>
        }
        expanded={row.open}
        onToggle={() => onToggle(row.folder.uid)}
      />
    </RuleRowList>
  );
}

function EmptyResult({ search }: { search: LegacyGroupsListingArg }) {
  if (!search.groupName && !search.folder) {
    return (
      <EmptyState
        variant="completed"
        message={t('alerting.gma-rule-list.legacy-groups.no-groups', 'No legacy groups')}
      />
    );
  }
  return (
    <EmptyState variant="not-found" message={t('alerting.gma-rule-list.legacy-groups.no-match', 'No groups match')}>
      {search.groupName && !search.folder && (
        <Trans i18nKey="alerting.gma-rule-list.legacy-groups.no-match-hint">
          Looking for a folder? Use the folder filter.
        </Trans>
      )}
    </EmptyState>
  );
}

/** Folder rows, each followed by its groups when open, so large folders are virtualised too. */
function toListRows(folders: LegacyGroupsFolder[], expanded: Set<string>): ListRow[] {
  return folders.flatMap((folder) => {
    const open = expanded.has(folder.uid);
    const groups = open ? folder.groups.map((group) => ({ key: `${folder.uid}/${group.name}`, folder, group })) : [];
    return [{ key: folder.uid, folder, open }, ...groups];
  });
}

function groupKey(group: GrafanaPromRuleGroupDTO) {
  return `${group.folderUid}/${group.name}`;
}

/** Folders with at least one alert rule, in API order: by full path with alertingRuleGroupSortByFolderFullpath. */
function groupByFolder(pages: LegacyGroupsPage[]): LegacyGroupsFolder[] {
  const byUid = new Map<string, LegacyGroupsFolder>();
  for (const group of pages.flatMap((page) => page.groups)) {
    if (!group.rules.some((rule) => rule.type !== PromRuleType.Recording)) {
      continue;
    }
    let folder = byUid.get(group.folderUid);
    if (!folder) {
      folder = { uid: group.folderUid, path: splitFolderPath(group.file), groups: [] };
      byUid.set(group.folderUid, folder);
    }
    folder.groups.push(group);
  }
  return [...byUid.values()];
}

const getStyles = () => ({
  listArea: css({
    position: 'relative',
  }),
  // Over the list, so showing it moves nothing.
  loadingBar: css({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  }),
});
