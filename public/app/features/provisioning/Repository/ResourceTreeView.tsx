import { css } from '@emotion/css';
import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useCallback, useId, useMemo, useState } from 'react';

import { textUtil, type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  type CellProps,
  type Column,
  type ComboboxOption,
  FilterInput,
  Icon,
  IconButton,
  InteractiveTable,
  Link,
  LinkButton,
  MultiCombobox,
  Spinner,
  Stack,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import {
  type Repository,
  useGetRepositoryFilesQuery,
  useGetRepositoryResourcesQuery,
} from 'app/api/clients/provisioning/v0alpha1';

import { type FlatTreeItem, type TreeItem } from '../types';
import { getRepoFileUrl } from '../utils/git';
import { getKindInfoByItemType } from '../utils/resourceKinds';
import {
  buildTree,
  filterByStatusCategories,
  filterTree,
  flattenTree,
  getIconName,
  getStatusCategory,
  type StatusCategory,
  mergeFilesAndResources,
} from '../utils/treeUtils';

interface ResourceTreeViewProps {
  repo: Repository;
}

type TreeCell<T extends keyof FlatTreeItem = keyof FlatTreeItem> = CellProps<FlatTreeItem, FlatTreeItem[T]>;

function getGrafanaLink(item: TreeItem) {
  if (item.resourceName) {
    return getKindInfoByItemType(item.type)?.getRoute?.(item.resourceName);
  }
  return undefined;
}

export function ResourceTreeView({ repo }: ResourceTreeViewProps) {
  const styles = useStyles2(getStyles);
  const name = repo.metadata?.name ?? '';

  const filesQuery = useGetRepositoryFilesQuery({ name });
  const resourcesQuery = useGetRepositoryResourcesQuery({ name });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusCategory[]>([]);
  const statusFilterLabelId = useId();
  // Folder paths that are currently unfolded. Empty by default so the tree starts fully folded.
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const provisioningFolderMetadataEnabled = useBooleanFlagValue('provisioningFolderMetadata', false);

  const isLoading = filesQuery.isLoading || resourcesQuery.isLoading;

  const statusFilterOptions: Array<ComboboxOption<StatusCategory>> = useMemo(() => {
    const options: Array<ComboboxOption<StatusCategory>> = [
      { label: t('provisioning.resource-tree.status-filter-synced', 'Synced'), value: 'synced' },
      { label: t('provisioning.resource-tree.status-filter-pending', 'Not in sync'), value: 'pending' },
    ];
    if (provisioningFolderMetadataEnabled) {
      options.push({ label: t('provisioning.resource-tree.status-filter-warning', 'Warnings'), value: 'warning' });
    }
    return options;
  }, [provisioningFolderMetadataEnabled]);

  const tree = useMemo(() => {
    const files = filesQuery.data?.items ?? [];
    const resources = resourcesQuery.data?.items ?? [];

    const merged = mergeFilesAndResources(files, resources);
    const built = buildTree(merged);

    // Filter by status before search: status filtering relies on the aggregate folder statuses
    // computed by buildTree, which filterTree would leave stale after pruning hidden children.
    const statusFiltered =
      statusFilter.length > 0
        ? filterByStatusCategories(built, statusFilter, provisioningFolderMetadataEnabled)
        : built;

    return searchQuery ? filterTree(statusFiltered, searchQuery) : statusFiltered;
  }, [
    filesQuery.data?.items,
    resourcesQuery.data?.items,
    searchQuery,
    statusFilter,
    provisioningFolderMetadataEnabled,
  ]);

  // A search or a status filter narrows the tree, so ignore the folded state while either is
  // active to keep every matching item visible instead of hidden inside a collapsed folder.
  const isFiltering = !!searchQuery || statusFilter.length > 0;
  const flatItems = useMemo(
    () => flattenTree(tree, isFiltering ? undefined : expandedPaths),
    [tree, expandedPaths, isFiltering]
  );

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const columns: Array<Column<FlatTreeItem>> = useMemo(
    () => [
      {
        id: 'title',
        header: t('provisioning.resource-tree.header-title', 'Title'),
        cell: ({ row: { original } }: TreeCell) => {
          const { item, level, isExpandable, isExpanded } = original;
          const iconName = getIconName(item.type);
          const link = getGrafanaLink(item);
          // Label the fold toggle by the item's own title so screen readers announce which
          // folder is being expanded/collapsed without needing a separate translated string.
          // Encode the path so ids stay whitespace-free — aria-labelledby is a space-separated
          // list, and folder paths may contain spaces.
          const titleId = `resource-tree-item-${encodeURIComponent(item.path)}`;

          return (
            <div className={styles.titleCell} style={{ paddingLeft: level * 24 }}>
              {isExpandable ? (
                <IconButton
                  name={isExpanded ? 'angle-down' : 'angle-right'}
                  size="sm"
                  onClick={() => handleToggleExpand(item.path)}
                  // A search or status filter forces every folder open, so the toggle can't
                  // change what's shown.
                  disabled={isFiltering}
                  aria-expanded={isExpanded}
                  aria-labelledby={titleId}
                />
              ) : (
                <span className={styles.expandSpacer} />
              )}
              <Icon name={iconName} className={styles.icon} />
              {link ? (
                <Link id={titleId} href={link}>
                  {item.title}
                </Link>
              ) : (
                <span id={titleId}>{item.title}</span>
              )}
            </div>
          );
        },
      },
      {
        id: 'type',
        header: t('provisioning.resource-tree.header-type', 'Type'),
        cell: ({ row: { original } }: TreeCell) => {
          return <span>{original.item.type}</span>;
        },
      },
      {
        id: 'status',
        header: t('provisioning.resource-tree.header-status', 'Status'),
        cell: ({ row: { original } }: TreeCell) => {
          const category = getStatusCategory(original.item, provisioningFolderMetadataEnabled);
          if (category === 'warning') {
            return (
              <Tooltip
                content={t('provisioning.resource-tree.missing-folder-metadata', 'Missing folder metadata file')}
              >
                <Icon
                  name="exclamation-triangle"
                  className={styles.warningIcon}
                  aria-label={t('provisioning.resource-tree.missing-folder-metadata', 'Missing folder metadata file')}
                />
              </Tooltip>
            );
          }
          if (!category) {
            return null;
          }
          return (
            <Icon
              name={category === 'synced' ? 'check-circle' : 'sync'}
              className={category === 'synced' ? styles.syncedIcon : undefined}
              title={
                category === 'synced'
                  ? t('provisioning.resource-tree.status-synced', 'Synced')
                  : t('provisioning.resource-tree.status-pending', 'Pending')
              }
            />
          );
        },
      },
      {
        id: 'hash',
        header: t('provisioning.resource-tree.header-hash', 'Hash'),
        cell: ({ row: { original } }: TreeCell) => {
          const { hash } = original.item;
          if (!hash) {
            return null;
          }
          return (
            <span title={hash} className={styles.hash}>
              {hash.substring(0, 7)}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row: { original } }: TreeCell) => {
          const { item } = original;
          const isDotKeepFile = item.path.endsWith('.keep') || item.path.endsWith('.gitkeep');
          if (isDotKeepFile) {
            return null;
          }

          const viewLink = getGrafanaLink(item);
          let sourceLink: string | undefined = undefined;
          if (item.hasFile && repo.spec?.type) {
            const spec = repo.spec;
            const config = spec.github || spec.githubEnterprise || spec.gitlab || spec.bitbucket;
            if (config) {
              const rawSourceLink = getRepoFileUrl({
                repoType: spec.type,
                url: config.url,
                branch: config.branch,
                filePath: item.path,
                pathPrefix: config.path,
              });
              sourceLink = rawSourceLink ? textUtil.sanitizeUrl(rawSourceLink) : undefined;
            }
          }

          if (!viewLink && !sourceLink) {
            return null;
          }

          return (
            <Stack direction="row" gap={1}>
              {viewLink && (
                <LinkButton href={viewLink} size="sm" variant="secondary">
                  <Trans i18nKey="provisioning.resource-tree.view">View</Trans>
                </LinkButton>
              )}
              {sourceLink && (
                <LinkButton href={sourceLink} size="sm" variant="secondary" target="_blank">
                  <Trans i18nKey="provisioning.resource-tree.source">Source</Trans>
                </LinkButton>
              )}
            </Stack>
          );
        },
      },
    ],
    [handleToggleExpand, isFiltering, provisioningFolderMetadataEnabled, repo.spec, styles]
  );

  if (isLoading) {
    return (
      <Stack justifyContent="center" alignItems="center">
        <Spinner />
      </Stack>
    );
  }

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="row" gap={2} alignItems="flex-start">
        <div className={styles.searchInput}>
          <FilterInput
            placeholder={t('provisioning.resource-tree.search-placeholder', 'Search by path or title')}
            autoFocus={true}
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>
        {/* MultiCombobox forwards aria-labelledby (not aria-label), so label it via a hidden element. */}
        <span id={statusFilterLabelId} className="sr-only">
          {t('provisioning.resource-tree.status-filter-aria-label', 'Filter by status')}
        </span>
        <MultiCombobox
          prefixIcon="filter"
          options={statusFilterOptions}
          value={statusFilter}
          onChange={(options) => setStatusFilter(options.map((option) => option.value))}
          isClearable
          width={30}
          placeholder={t('provisioning.resource-tree.status-filter-placeholder', 'Filter by status')}
          aria-labelledby={statusFilterLabelId}
        />
      </Stack>
      <InteractiveTable
        columns={columns}
        data={flatItems}
        pageSize={25}
        // Folding rows or clearing a search can shrink the list below the current page; reset to
        // the first page so users aren't stranded on a now-empty page.
        autoResetPage={true}
        getRowId={(item: FlatTreeItem) => item.item.path}
      />
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  searchInput: css({
    flexGrow: 1,
  }),
  titleCell: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  // Keeps rows without a fold control aligned with the chevron on foldable rows.
  expandSpacer: css({
    display: 'inline-block',
    width: theme.spacing(2),
    flexShrink: 0,
  }),
  icon: css({
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),
  hash: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  syncedIcon: css({
    color: theme.colors.success.text,
  }),
  warningIcon: css({
    color: theme.colors.warning.text,
  }),
});
