import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Button,
  CellProps,
  Column,
  FilterInput,
  Icon,
  InteractiveTable,
  Link,
  LinkButton,
  Spinner,
  Stack,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import {
  Repository,
  useGetRepositoryFilesQuery,
  useGetRepositoryResourcesQuery,
} from 'app/api/clients/provisioning/v0alpha1';

import { FlatTreeItem, TreeItem } from '../types';
import { getRepoFileUrl } from '../utils/git';
import {
  buildTree,
  countMissingMetadata,
  filterTree,
  flattenTree,
  getIconName,
  mergeFilesAndResources,
} from '../utils/treeUtils';

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
  const [isFixing, setIsFixing] = useState(false);

  const isLoading = filesQuery.isLoading || resourcesQuery.isLoading;

  const { flatItems, missingCount } = useMemo(() => {
    const files = filesQuery.data?.items ?? [];
    const resources = resourcesQuery.data?.items ?? [];

    const merged = mergeFilesAndResources(files, resources);
    let tree = buildTree(merged);
    const missing = countMissingMetadata(tree);

    if (searchQuery) {
      tree = filterTree(tree, searchQuery);
    }

    return { flatItems: flattenTree(tree), missingCount: missing };
  }, [filesQuery.data?.items, resourcesQuery.data?.items, searchQuery]);

  const handleFixFolderIds = () => {
    setIsFixing(true);
    // SPIKE: Simulate creating a PR job to fix folder metadata
    setTimeout(() => setIsFixing(false), 2000);
  };

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
          const { status, missingMetadata } = original.item;

          if (missingMetadata) {
            return (
              <Tooltip content={t('provisioning.resource-tree.missing-metadata', 'Missing .folder.json metadata file')}>
                <Icon name="exclamation-triangle" className={styles.warningIcon} />
              </Tooltip>
            );
          }

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
            const ghConfig = spec.github || spec.gitlab || spec.bitbucket;
            if (ghConfig) {
              sourceLink = getRepoFileUrl({
                repoType: spec.type,
                url: ghConfig.url,
                branch: ghConfig.branch,
                filePath: item.path,
                pathPrefix: ghConfig.path,
              });
            }
          }

          return (
            <Stack direction="row" gap={1}>
              {item.missingMetadata && (
                <Button size="sm" variant="secondary" icon="wrench" onClick={handleFixFolderIds} disabled={isFixing}>
                  <Trans i18nKey="provisioning.resource-tree.fix">Fix</Trans>
                </Button>
              )}
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
    [repo.spec, styles, handleFixFolderIds, isFixing]
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
      {missingCount > 0 && (
        <Alert
          severity="warning"
          title={t(
            'provisioning.resource-tree.missing-metadata-alert',
            '{{count}} folder(s) are missing .folder.json metadata files',
            { count: missingCount }
          )}
        >
          <Stack direction="row" alignItems="center" gap={2}>
            <span>
              <Trans i18nKey="provisioning.resource-tree.missing-metadata-description">
                Folders without metadata files may lose their identity across syncs. Fix this by creating a PR to add
                the missing files.
              </Trans>
            </span>
            <Button variant="secondary" icon="wrench" onClick={handleFixFolderIds} disabled={isFixing}>
              {isFixing ? (
                <Trans i18nKey="provisioning.resource-tree.fixing">Fixing...</Trans>
              ) : (
                <Trans i18nKey="provisioning.resource-tree.fix-all">Fix folder IDs</Trans>
              )}
            </Button>
          </Stack>
        </Alert>
      )}
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
  warningIcon: css({
    color: theme.colors.warning.text,
  }),
});
