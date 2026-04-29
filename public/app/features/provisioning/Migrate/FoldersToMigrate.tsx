import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Badge,
  Checkbox,
  type Column,
  EmptyState,
  FilterInput,
  Icon,
  InteractiveTable,
  LinkButton,
  Stack,
  Text,
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

interface Props {
  folders: FolderRow[];
  repos: Repository[];
  selectedFolders: Set<string>;
  onToggleFolder: (uid: string) => void;
}

/**
 * Browseable table of folders. Each row offers a per-folder Migrate target
 * (currently the connected repo, otherwise the getting-started flow) plus a
 * "Browse" link that drops the user into the regular folder view so they can
 * pick individual dashboards to act on.
 */
export function FoldersToMigrate({ folders, repos, selectedFolders, onToggleFolder }: Props) {
  const styles = useStyles2(getStyles);
  const [search, setSearch] = useState('');
  const [onlyUnmanaged, setOnlyUnmanaged] = useState(true);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return folders.filter((folder) => {
      if (onlyUnmanaged && folder.unmanagedDashboardCount === 0) {
        return false;
      }
      if (q && !folder.title.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [folders, search, onlyUnmanaged]);

  const target = migrateTarget(repos);
  const ctaLabel = migrateButtonLabel(repos);
  const totalSelected = selectedFolders.size;

  const allSelected = filtered.length > 0 && filtered.every((f) => selectedFolders.has(f.uid));
  const someSelected = !allSelected && filtered.some((f) => selectedFolders.has(f.uid));
  const toggleAllVisible = useCallback(() => {
    if (allSelected) {
      filtered.forEach((f) => {
        if (selectedFolders.has(f.uid)) {
          onToggleFolder(f.uid);
        }
      });
    } else {
      filtered.forEach((f) => {
        if (!selectedFolders.has(f.uid)) {
          onToggleFolder(f.uid);
        }
      });
    }
  }, [allSelected, filtered, selectedFolders, onToggleFolder]);

  const columns: Array<Column<FolderRow>> = useMemo(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            value={allSelected}
            indeterminate={someSelected}
            onChange={toggleAllVisible}
            aria-label={t('provisioning.stats.folders-select-all-visible', 'Select all visible folders')}
            disabled={filtered.length === 0}
          />
        ),
        disableGrow: true,
        cell: ({ row }) => (
          <Checkbox
            value={selectedFolders.has(row.original.uid)}
            onChange={() => onToggleFolder(row.original.uid)}
            aria-label={t('provisioning.stats.folders-select', 'Select folder {{folder}}', {
              folder: row.original.title,
            })}
          />
        ),
      },
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
        id: 'unmanagedDashboardCount',
        header: t('provisioning.stats.folders-column-unmanaged', 'Unmanaged'),
        sortType: 'number',
        cell: ({ row }) => {
          const n = row.original.unmanagedDashboardCount;
          if (n === 0) {
            return <Text color="secondary">{n}</Text>;
          }
          return (
            <Badge
              color="orange"
              text={t('provisioning.stats.folders-unmanaged-badge', '{{count}}', { count: n })}
            />
          );
        },
      },
      {
        id: 'provider',
        header: t('provisioning.stats.folders-column-provider', 'Provider'),
        cell: ({ row }) => {
          if (row.original.managerKinds.length === 0) {
            return (
              <Text variant="bodySmall" color="secondary">
                <Trans i18nKey="provisioning.stats.folders-provider-none">None</Trans>
              </Text>
            );
          }
          return (
            <Stack direction="row" gap={0.5} wrap>
              {row.original.managerKinds.map((kind) => (
                <Badge key={kind} color="blue" text={kind} />
              ))}
            </Stack>
          );
        },
      },
      {
        id: 'recommendation',
        header: t('provisioning.stats.folders-column-recommendation', 'Recommendation'),
        cell: ({ row }) => {
          if (row.original.unmanagedDashboardCount === 0 && row.original.managedDashboardCount > 0) {
            return (
              <Text color="success" variant="bodySmall">
                <Trans i18nKey="provisioning.stats.folders-recommendation-managed">
                  Already managed
                </Trans>
              </Text>
            );
          }
          if (row.original.unmanagedDashboardCount === 0) {
            return (
              <Text color="secondary" variant="bodySmall">
                <Trans i18nKey="provisioning.stats.folders-recommendation-empty">Nothing to do</Trans>
              </Text>
            );
          }
          if (row.original.managedDashboardCount === 0) {
            return (
              <Text variant="bodySmall">
                <Trans i18nKey="provisioning.stats.folders-recommendation-clean">
                  Migrate folder to Git Sync
                </Trans>
              </Text>
            );
          }
          return (
            <Text variant="bodySmall">
              <Trans i18nKey="provisioning.stats.folders-recommendation-mixed">
                Migrate the unmanaged dashboards
              </Trans>
            </Text>
          );
        },
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
            <LinkButton variant="secondary" size="sm" fill="text" href={folderBrowseUrl(row.original.uid)}>
              <Trans i18nKey="provisioning.stats.folders-browse">Browse</Trans>
            </LinkButton>
          </Stack>
        ),
      },
    ],
    // toggleAllVisible / allSelected / someSelected change frequently with the
    // filtered list — recompute columns when they do.
    [
      allSelected,
      someSelected,
      filtered,
      selectedFolders,
      onToggleFolder,
      target,
      ctaLabel,
      toggleAllVisible,
    ]
  );

  return (
    <div className={styles.panel} id="folders-to-migrate">
      <Stack direction="column" gap={0.5}>
        <Text variant="h5">
          <Trans i18nKey="provisioning.stats.folders-to-migrate-heading">Folders to migrate</Trans>
        </Text>
        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="provisioning.stats.folders-to-migrate-subtitle">
            Browse folders and migrate them one at a time, or pick several and bulk-migrate them. Use Browse to
            jump into a folder and act on individual dashboards.
          </Trans>
        </Text>
      </Stack>

      <Stack direction="row" gap={1} alignItems="center" wrap>
        <div className={styles.searchInput}>
          <FilterInput
            placeholder={t('provisioning.stats.folders-to-migrate-search', 'Search folders')}
            value={search}
            onChange={setSearch}
          />
        </div>
        <Checkbox
          value={onlyUnmanaged}
          onChange={(e) => setOnlyUnmanaged(e.currentTarget.checked)}
          label={t('provisioning.stats.folders-to-migrate-only-unmanaged', 'Has unmanaged only')}
        />
        <div className={styles.spacer} />
        {totalSelected > 0 && (
          <LinkButton variant="primary" size="sm" icon="upload" href={target}>
            {t('provisioning.stats.folders-to-migrate-bulk-cta', 'Migrate selected ({{count}})', {
              count: totalSelected,
            })}
          </LinkButton>
        )}
      </Stack>

      {filtered.length === 0 ? (
        <EmptyState
          variant="not-found"
          message={t(
            'provisioning.stats.folders-to-migrate-empty',
            'No folders match the current filters.'
          )}
        />
      ) : (
        <InteractiveTable
          columns={columns}
          data={filtered}
          getRowId={(row) => row.uid}
          pageSize={10}
        />
      )}

      <Text variant="bodySmall" color="secondary">
        {t('provisioning.stats.folders-to-migrate-footer', 'Showing {{count}} of {{total}} folders', {
          count: filtered.length,
          total: folders.length,
        })}
      </Text>
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
  spacer: css({
    flex: '1 1 auto',
  }),
});
