import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  CellProps,
  Column,
  FilterInput,
  Icon,
  InteractiveTable,
  Link,
  LinkButton,
  Spinner,
  Stack,
  useStyles2,
} from '@grafana/ui';
import {
  Repository,
  useGetRepositoryFilesQuery,
  useGetRepositoryResourcesQuery,
} from 'app/api/clients/provisioning/v0alpha1';

import { PROVISIONING_URL } from '../constants';
import { FlatTreeItem } from '../types';
import { buildTree, filterTree, flattenTree, getIconName, mergeFilesAndResources } from '../utils/treeUtils';

interface ResourceTreeViewProps {
  repo: Repository;
}

type TreeCell<T extends keyof FlatTreeItem = keyof FlatTreeItem> = CellProps<FlatTreeItem, FlatTreeItem[T]>;

export function ResourceTreeView({ repo }: ResourceTreeViewProps) {
  const styles = useStyles2(getStyles);
  const name = repo.metadata?.name ?? '';

  const filesQuery = useGetRepositoryFilesQuery({ name });
  const resourcesQuery = useGetRepositoryResourcesQuery({ name });

  const [searchQuery, setSearchQuery] = useState('');

  const isLoading = filesQuery.isLoading || resourcesQuery.isLoading;

  // Build tree from merged data
  const flatItems = useMemo(() => {
    const files = filesQuery.data?.items ?? [];
    const resources = resourcesQuery.data?.items ?? [];

    const merged = mergeFilesAndResources(files, resources);
    let tree = buildTree(merged);

    // Apply search filter
    if (searchQuery) {
      tree = filterTree(tree, searchQuery);
    }

    return flattenTree(tree);
  }, [filesQuery.data?.items, resourcesQuery.data?.items, searchQuery]);

  const columns: Array<Column<FlatTreeItem>> = useMemo(
    () => [
      {
        id: 'title',
        header: t('provisioning.resource-tree.header-title', 'Title'),
        cell: ({ row: { original } }: TreeCell) => {
          const { item, level } = original;
          const iconName = getIconName(item.type);

          // Determine link based on type
          const getItemLink = () => {
            if (item.type === 'Dashboard' && item.resourceName) {
              return `/d/${item.resourceName}`;
            }
            if (item.type === 'Folder' && item.resourceName) {
              return `/dashboards/f/${item.resourceName}`;
            }
            return undefined;
          };

          const titleLink = getItemLink();

          return (
            <div className={styles.titleCell} style={{ paddingLeft: level * 24 }}>
              <Icon name={iconName} className={styles.icon} />
              {titleLink ? <Link href={titleLink}>{item.title}</Link> : <span>{item.title}</span>}
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

          const getViewLink = () => {
            if (item.type === 'Dashboard' && item.resourceName) {
              return `/d/${item.resourceName}`;
            }
            if (item.type === 'Folder' && item.resourceName) {
              return `/dashboards/f/${item.resourceName}`;
            }
            // For files, link to file view
            if (item.type === 'File') {
              return `${PROVISIONING_URL}/${name}/file/${item.path}`;
            }
            return undefined;
          };

          const viewLink = getViewLink();

          if (!viewLink) {
            return null;
          }

          return (
            <LinkButton href={viewLink} size="sm" variant="secondary">
              <Trans i18nKey="provisioning.resource-tree.view">View</Trans>
            </LinkButton>
          );
        },
      },
    ],
    [name, styles]
  );

  if (isLoading) {
    return (
      <Stack justifyContent="center" alignItems="center">
        <Spinner />
      </Stack>
    );
  }

  return (
    <Stack grow={1} direction="column" gap={2}>
      <Stack gap={2}>
        <FilterInput
          placeholder={t('provisioning.resource-tree.search-placeholder', 'Search by path or title')}
          autoFocus={true}
          value={searchQuery}
          onChange={setSearchQuery}
        />
      </Stack>
      <InteractiveTable
        columns={columns}
        data={flatItems}
        pageSize={25}
        getRowId={(item: FlatTreeItem) => item.item.path}
      />
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  titleCell: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
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
});
