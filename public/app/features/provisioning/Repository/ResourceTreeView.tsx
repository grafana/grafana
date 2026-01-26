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

import { FlatTreeItem, TreeItem } from '../types';
import { getRepoFileUrl } from '../utils/git';
import { buildTree, filterTree, flattenTree, getIconName, mergeFilesAndResources } from '../utils/treeUtils';

interface ResourceTreeViewProps {
  repo: Repository;
}

type TreeCell<T extends keyof FlatTreeItem = keyof FlatTreeItem> = CellProps<FlatTreeItem, FlatTreeItem[T]>;

function getGrafanaLink(item: TreeItem) {
  if (item.resourceName) {
    if (item.type === 'Dashboard') {
      return `/d/${item.resourceName}`;
    }
    if (item.type === 'Folder') {
      return `/dashboards/f/${item.resourceName}`;
    }
  }
  return undefined;
}

export function ResourceTreeView({ repo }: ResourceTreeViewProps) {
  const styles = useStyles2(getStyles);
  const name = repo.metadata?.name ?? '';

  const filesQuery = useGetRepositoryFilesQuery({ name });
  const resourcesQuery = useGetRepositoryResourcesQuery({ name });

  const [searchQuery, setSearchQuery] = useState('');

  const isLoading = filesQuery.isLoading || resourcesQuery.isLoading;

  const flatItems = useMemo(() => {
    const files = filesQuery.data?.items ?? [];
    const resources = resourcesQuery.data?.items ?? [];

    const merged = mergeFilesAndResources(files, resources);
    let tree = buildTree(merged);

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
          const link = getGrafanaLink(item);

          return (
            <div className={styles.titleCell} style={{ paddingLeft: level * 24 }}>
              <Icon name={iconName} className={styles.icon} />
              {link ? <Link href={link}>{item.title}</Link> : <span>{item.title}</span>}
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
          const { status } = original.item;
          if (!status) {
            return null;
          }
          return (
            <Icon
              name={status === 'synced' ? 'check-circle' : 'sync'}
              className={status === 'synced' ? styles.syncedIcon : undefined}
              title={
                status === 'synced'
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
            const config = spec.github || spec.gitlab || spec.bitbucket;
            if (config) {
              sourceLink = getRepoFileUrl({
                repoType: spec.type,
                url: config.url,
                branch: config.branch,
                filePath: item.path,
                pathPrefix: config.path,
              });
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
    [repo.spec, styles]
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
      <FilterInput
        placeholder={t('provisioning.resource-tree.search-placeholder', 'Search by path or title')}
        autoFocus={true}
        value={searchQuery}
        onChange={setSearchQuery}
      />
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
  syncedIcon: css({
    color: theme.colors.success.text,
  }),
});
