import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Button,
  type Column,
  EmptyState,
  FilterInput,
  Icon,
  InteractiveTable,
  LinkButton,
  Stack,
  Text,
  Toggletip,
  useStyles2,
} from '@grafana/ui';
import { type Repository } from 'app/api/clients/provisioning/v0alpha1';

import { GETTING_STARTED_URL, PROVISIONING_URL } from '../constants';

import { type FolderRow } from './hooks/useFolderLeaderboard';

function migrateTarget(repos: Repository[]): string {
  if (repos.length === 0) {
    return GETTING_STARTED_URL;
  }
  if (repos.length === 1 && repos[0].metadata?.name) {
    return `${PROVISIONING_URL}/${repos[0].metadata.name}`;
  }
  return PROVISIONING_URL;
}

function migrateButtonLabel(repos: Repository[]): string {
  if (repos.length === 0) {
    return t('provisioning.stats.folders-migrate-to-git-sync', 'Migrate to Git Sync');
  }
  if (repos.length === 1 && repos[0].metadata?.name) {
    return t('provisioning.stats.folders-migrate-to-repo', 'Migrate to {{repo}}', {
      repo: repos[0].metadata.name,
    });
  }
  return t('provisioning.stats.folders-migrate-to-repository', 'Migrate to repository');
}

function folderBrowseUrl(uid: string): string {
  return `/dashboards/f/${encodeURIComponent(uid)}`;
}

function FolderPeek({ folder }: { folder: FolderRow }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.peek}>
      {folder.subfolders.length === 0 && folder.directDashboards.length === 0 ? (
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="provisioning.stats.folders-peek-empty">
            This folder is empty. Migrating it creates an empty folder in your repository.
          </Trans>
        </Text>
      ) : (
        <Stack direction="column" gap={1}>
          {folder.subfolders.length > 0 && (
            <Stack direction="column" gap={0.5}>
              <Text variant="bodySmall" weight="medium">
                {t('provisioning.stats.folders-peek-subfolders', 'Subfolders ({{count}})', {
                  count: folder.subfolders.length,
                })}
              </Text>
              {folder.subfolders.map((sub) => (
                <Stack key={sub.uid} direction="row" gap={1} alignItems="center">
                  <Icon name="folder" size="sm" />
                  <a className={styles.peekLink} href={folderBrowseUrl(sub.uid)}>
                    {sub.title}
                  </a>
                  <Text variant="bodySmall" color="secondary">
                    {t('provisioning.stats.folders-peek-subfolder-count', '· {{count}} dashboards', {
                      count: sub.dashboardCount,
                    })}
                  </Text>
                </Stack>
              ))}
            </Stack>
          )}
          {folder.directDashboards.length > 0 && (
            <Stack direction="column" gap={0.5}>
              <Text variant="bodySmall" weight="medium">
                {t('provisioning.stats.folders-peek-dashboards', 'Dashboards ({{count}})', {
                  count: folder.directDashboards.length,
                })}
              </Text>
              {folder.directDashboards.map((dash) => (
                <Stack key={dash.uid} direction="row" gap={1} alignItems="center">
                  <Icon name="apps" size="sm" />
                  <a className={styles.peekLink} href={dash.url || `/d/${encodeURIComponent(dash.uid)}`}>
                    {dash.title}
                  </a>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      )}
    </div>
  );
}

interface Props {
  folders: FolderRow[];
  repos: Repository[];
}

/**
 * Browseable list of folders that aren't managed yet. Already-managed folders
 * are filtered out — the page is scoped to migration targets only. Each row
 * exposes a per-folder Migrate target plus a Browse link into the regular
 * folder view.
 */
export function FoldersToMigrate({ folders, repos }: Props) {
  const styles = useStyles2(getStyles);
  const [search, setSearch] = useState('');

  const unmanagedFolders = useMemo(() => folders.filter((f) => !f.managedBy), [folders]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return unmanagedFolders;
    }
    return unmanagedFolders.filter((folder) => folder.title.toLowerCase().includes(q));
  }, [unmanagedFolders, search]);

  const target = migrateTarget(repos);
  const ctaLabel = migrateButtonLabel(repos);

  const columns: Array<Column<FolderRow>> = useMemo(
    () => [
      {
        id: 'title',
        header: t('provisioning.stats.folders-column-name', 'Name'),
        sortType: 'string',
        cell: ({ row }) => (
          <Stack direction="row" gap={1} alignItems="center">
            <Icon name="folder" />
            <Stack direction="column" gap={0}>
              <Text>{row.original.title}</Text>
              {row.original.parentTitle && (
                <Text variant="bodySmall" color="secondary">
                  {row.original.parentTitle}
                </Text>
              )}
            </Stack>
          </Stack>
        ),
      },
      {
        id: 'dashboardCount',
        header: t('provisioning.stats.folders-column-dashboards', 'Dashboards'),
        sortType: 'number',
        cell: ({ row }) => <Text>{row.original.dashboardCount.toLocaleString()}</Text>,
      },
      {
        id: 'actions',
        header: '',
        disableGrow: true,
        cell: ({ row }) => (
          <Stack direction="row" gap={1} alignItems="center" justifyContent="flex-end">
            <LinkButton variant="primary" size="sm" icon="upload" href={target}>
              {ctaLabel}
            </LinkButton>
            <Toggletip
              content={<FolderPeek folder={row.original} />}
              title={row.original.title}
              placement="top-end"
            >
              <Button variant="secondary" size="sm" fill="text" icon="eye">
                <Trans i18nKey="provisioning.stats.folders-peek">Peek</Trans>
              </Button>
            </Toggletip>
          </Stack>
        ),
      },
    ],
    [target, ctaLabel]
  );

  return (
    <div className={styles.panel} id="folders-to-migrate">
      <Stack direction="column" gap={0.5}>
        <Text variant="h5">
          <Trans i18nKey="provisioning.stats.folders-to-migrate-heading">Folders to migrate</Trans>
        </Text>
        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="provisioning.stats.folders-to-migrate-subtitle">
            Folders that aren&apos;t managed by any provisioning tool yet. Migrate one at a time, or use Browse
            to jump into a folder and act on individual dashboards.
          </Trans>
        </Text>
      </Stack>

      <div className={styles.searchInput}>
        <FilterInput
          placeholder={t('provisioning.stats.folders-to-migrate-search', 'Search folders')}
          value={search}
          onChange={setSearch}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          variant="not-found"
          message={
            unmanagedFolders.length === 0
              ? t(
                  'provisioning.stats.folders-to-migrate-all-managed',
                  'All folders are already managed.'
                )
              : t(
                  'provisioning.stats.folders-to-migrate-empty',
                  'No folders match the current search.'
                )
          }
        />
      ) : (
        <InteractiveTable columns={columns} data={filtered} getRowId={(row) => row.uid} pageSize={10} />
      )}

      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between" wrap>
        <Text variant="bodySmall" color="secondary">
          {t('provisioning.stats.folders-to-migrate-footer', 'Showing {{count}} of {{total}} folders', {
            count: filtered.length,
            total: unmanagedFolders.length,
          })}
        </Text>
        {unmanagedFolders.length > 0 && (
          <LinkButton variant="primary" icon="upload" href={target}>
            {t('provisioning.stats.folders-to-migrate-migrate-all', 'Migrate everything ({{count}} folders)', {
              count: unmanagedFolders.length,
            })}
          </LinkButton>
        )}
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  panel: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2.5),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.secondary,
  }),
  searchInput: css({
    flex: '1 1 auto',
    minWidth: 200,
  }),
  peek: css({
    minWidth: 220,
    maxWidth: 360,
    maxHeight: 320,
    overflowY: 'auto',
  }),
  peekLink: css({
    color: theme.colors.text.link,
    fontSize: theme.typography.bodySmall.fontSize,
    '&:hover': {
      textDecoration: 'underline',
    },
  }),
});
