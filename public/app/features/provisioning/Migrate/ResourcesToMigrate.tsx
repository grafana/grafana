import { css, cx } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Button,
  Checkbox,
  Combobox,
  EmptyState,
  FilterInput,
  Icon,
  IconButton,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';

import { type FolderRow } from './hooks/useFolderMigrationData';
import { isMigratableFolder } from './selection';

export type SortKey = 'count-desc' | 'count-asc' | 'title-asc' | 'title-desc';

export function compareFolders(a: FolderRow, b: FolderRow, key: SortKey): number {
  switch (key) {
    case 'count-desc':
      if (b.dashboardCount !== a.dashboardCount) {
        return b.dashboardCount - a.dashboardCount;
      }
      // eslint-disable-next-line @grafana/no-locale-compare
      return a.title.localeCompare(b.title);
    case 'count-asc':
      if (a.dashboardCount !== b.dashboardCount) {
        return a.dashboardCount - b.dashboardCount;
      }
      // eslint-disable-next-line @grafana/no-locale-compare
      return a.title.localeCompare(b.title);
    case 'title-asc':
      // eslint-disable-next-line @grafana/no-locale-compare
      return a.title.localeCompare(b.title);
    case 'title-desc':
      // eslint-disable-next-line @grafana/no-locale-compare
      return b.title.localeCompare(a.title);
  }
}

interface Props {
  folders: FolderRow[];
  selectedFolderUids: Set<string>;
  selectedDashboardUids: Set<string>;
  onToggleFolder: (uid: string) => void;
  onToggleDashboard: (uid: string) => void;
  /** Folders + independently-ticked resources, shown in the migrate button. */
  selectedCount: number;
  /** True when every migratable folder is selected — migrates everything. */
  allSelected: boolean;
  /** True when at least one folder/resource is selected (drives the indeterminate select-all). */
  someSelected: boolean;
  onToggleSelectAll: () => void;
  onMigrateSelected: () => void;
  migrateDisabled: boolean;
  migrateTooltip?: string;
}

/**
 * Foldable, searchable list of unmanaged folders with the resources inside
 * them. Folders and individual resources can be selected; the migrate footer
 * action hands the selection to the migrate drawer. Already-managed folders are
 * filtered out — the panel is scoped to migration targets only.
 *
 * Resources are dashboards today, but the wording stays resource-generic so the
 * panel reads correctly as more resource types become migratable.
 */
export function ResourcesToMigrate({
  folders,
  selectedFolderUids,
  selectedDashboardUids,
  onToggleFolder,
  onToggleDashboard,
  selectedCount,
  allSelected,
  someSelected,
  onToggleSelectAll,
  onMigrateSelected,
  migrateDisabled,
  migrateTooltip,
}: Props) {
  const styles = useStyles2(getStyles);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('count-desc');

  const unmanagedFolders = useMemo(() => folders.filter(isMigratableFolder), [folders]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = !q
      ? unmanagedFolders.slice()
      : unmanagedFolders.filter((folder) => {
          if (folder.title.toLowerCase().includes(q)) {
            return true;
          }
          return folder.directDashboards.some((d) => d.title.toLowerCase().includes(q));
        });
    matched.sort((a, b) => compareFolders(a, b, sortKey));
    return matched;
  }, [unmanagedFolders, search, sortKey]);

  // Resources inside a selected folder appear ticked but can't be toggled
  // individually — the user deselects the folder first. Recomputed here (never
  // stored) so deselecting one folder doesn't strip resources covered by
  // another.
  const folderCoveredDashboardUids = useMemo(() => {
    const covered = new Set<string>();
    for (const folder of folders) {
      if (selectedFolderUids.has(folder.uid)) {
        folder.allDashboards.forEach((d) => covered.add(d.uid));
      }
    }
    return covered;
  }, [folders, selectedFolderUids]);

  const toggleExpanded = (uid: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  };

  return (
    <div className={styles.panel} id="resources-to-migrate">
      <Stack direction="column" gap={0.5}>
        <Text variant="h5">
          <Trans i18nKey="provisioning.migrate.resources-to-migrate-heading">Resources to migrate</Trans>
        </Text>
        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="provisioning.migrate.resources-to-migrate-subtitle">
            Pick whole folders or individual resources. Selecting a folder migrates everything inside it.
          </Trans>
        </Text>
      </Stack>

      <Stack direction="row" gap={1} alignItems="center" wrap>
        <div className={styles.searchInput}>
          <FilterInput
            placeholder={t('provisioning.migrate.resources-to-migrate-search', 'Search folders and resources')}
            value={search}
            onChange={setSearch}
          />
        </div>
        <div className={styles.sortInput}>
          <Combobox<SortKey>
            options={[
              {
                value: 'count-desc',
                label: t('provisioning.migrate.resources-sort-count-desc', 'Most resources'),
              },
              {
                value: 'count-asc',
                label: t('provisioning.migrate.resources-sort-count-asc', 'Fewest resources'),
              },
              { value: 'title-asc', label: t('provisioning.migrate.resources-sort-title-asc', 'Name (A–Z)') },
              {
                value: 'title-desc',
                label: t('provisioning.migrate.resources-sort-title-desc', 'Name (Z–A)'),
              },
            ]}
            value={sortKey}
            onChange={(opt) => {
              if (opt?.value) {
                setSortKey(opt.value);
              }
            }}
            aria-label={t('provisioning.migrate.resources-sort-aria', 'Sort folders')}
          />
        </div>
      </Stack>

      {unmanagedFolders.length > 0 && (
        <div className={styles.selectAllRow}>
          <Checkbox
            // Checkbox only ever sets the native `indeterminate` property to
            // true and never clears it, so once this box has been partially
            // selected it would stay visually indeterminate even after every
            // row is selected. Drive the property ourselves so it resets to a
            // plain checked state when allSelected becomes true.
            ref={(el) => {
              if (el) {
                el.indeterminate = someSelected && !allSelected;
              }
            }}
            value={allSelected}
            indeterminate={someSelected && !allSelected}
            onChange={onToggleSelectAll}
            label={t('provisioning.migrate.resources-select-all', 'Select all')}
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          variant="not-found"
          message={
            unmanagedFolders.length === 0
              ? t('provisioning.migrate.resources-to-migrate-all-managed', 'All folders are already managed.')
              : t(
                  'provisioning.migrate.resources-to-migrate-empty',
                  'No folders or resources match the current search.'
                )
          }
        />
      ) : (
        <div className={styles.list}>
          {filtered.map((folder) => (
            <FolderEntry
              key={folder.uid}
              folder={folder}
              isExpanded={expanded.has(folder.uid)}
              isSelected={selectedFolderUids.has(folder.uid)}
              selectedDashboardUids={selectedDashboardUids}
              folderCoveredDashboardUids={folderCoveredDashboardUids}
              onToggleExpanded={() => toggleExpanded(folder.uid)}
              onToggleFolder={() => onToggleFolder(folder.uid)}
              onToggleDashboard={onToggleDashboard}
            />
          ))}
        </div>
      )}

      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between" wrap>
        <Text variant="bodySmall" color="secondary">
          {t('provisioning.migrate.resources-to-migrate-footer', '', {
            count: filtered.length,
            total: unmanagedFolders.length,
            defaultValue_one: 'Showing {{count}} of {{total}} folders',
            defaultValue_other: 'Showing {{count}} of {{total}} folders',
          })}
        </Text>
        {unmanagedFolders.length > 0 && (
          <Button
            variant="primary"
            icon="upload"
            onClick={onMigrateSelected}
            disabled={selectedCount === 0 || migrateDisabled}
            tooltip={migrateDisabled ? migrateTooltip : undefined}
          >
            {allSelected
              ? t('provisioning.migrate.resources-to-migrate-migrate-all', '', {
                  count: selectedCount,
                  defaultValue_one: 'Migrate all ({{count}})',
                  defaultValue_other: 'Migrate all ({{count}})',
                })
              : t('provisioning.migrate.resources-to-migrate-migrate-selected', '', {
                  count: selectedCount,
                  defaultValue_one: 'Migrate selected ({{count}})',
                  defaultValue_other: 'Migrate selected ({{count}})',
                })}
          </Button>
        )}
      </Stack>
    </div>
  );
}

interface FolderEntryProps {
  folder: FolderRow;
  isExpanded: boolean;
  isSelected: boolean;
  selectedDashboardUids: Set<string>;
  folderCoveredDashboardUids: Set<string>;
  onToggleExpanded: () => void;
  onToggleFolder: () => void;
  onToggleDashboard: (uid: string) => void;
}

function FolderEntry({
  folder,
  isExpanded,
  isSelected,
  selectedDashboardUids,
  folderCoveredDashboardUids,
  onToggleExpanded,
  onToggleFolder,
  onToggleDashboard,
}: FolderEntryProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={cx(styles.row, isSelected && styles.rowSelected)}>
      <div className={styles.rowHeader}>
        <IconButton
          name={isExpanded ? 'angle-down' : 'angle-right'}
          aria-label={
            isExpanded
              ? t('provisioning.migrate.resources-collapse', 'Collapse {{folder}}', { folder: folder.title })
              : t('provisioning.migrate.resources-expand', 'Expand {{folder}}', { folder: folder.title })
          }
          onClick={onToggleExpanded}
        />
        <Checkbox
          value={isSelected}
          onChange={onToggleFolder}
          aria-label={t('provisioning.migrate.resources-select-folder', 'Select folder {{folder}}', {
            folder: folder.title,
          })}
        />
        <Icon name="folder" />
        <Stack direction="column" gap={0} flex={1}>
          <Text>{folder.title}</Text>
          <Text variant="bodySmall" color="secondary">
            {t('provisioning.migrate.resources-folder-summary', '', {
              count: folder.dashboardCount,
              defaultValue_one: '{{count}} resource',
              defaultValue_other: '{{count}} resources',
            })}
          </Text>
        </Stack>
      </div>
      {isExpanded && (
        <div className={styles.children}>
          {folder.directDashboards.length === 0 ? (
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="provisioning.migrate.resources-folder-only-subfolders">
                Resources in this folder live in subfolders. Migrate the folder to bring them all in one go.
              </Trans>
            </Text>
          ) : (
            folder.directDashboards.map((dash) => {
              const coveredByFolder = folderCoveredDashboardUids.has(dash.uid);
              const checked = coveredByFolder || selectedDashboardUids.has(dash.uid);
              return (
                <div key={`dash-${dash.uid}`} className={styles.childRow}>
                  <Checkbox
                    value={checked}
                    disabled={coveredByFolder}
                    onChange={() => onToggleDashboard(dash.uid)}
                    aria-label={dash.title}
                  />
                  <Icon name="apps" size="sm" />
                  <Text variant="bodySmall">{dash.title}</Text>
                </div>
              );
            })
          )}
        </div>
      )}
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
  sortInput: css({
    flex: '0 0 auto',
    minWidth: 200,
  }),
  selectAllRow: css({
    display: 'flex',
    alignItems: 'center',
    paddingLeft: theme.spacing(0.5),
  }),
  list: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  row: css({
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(1, 1.25),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.primary,
  }),
  rowSelected: css({
    borderColor: theme.colors.primary.border,
    background: theme.colors.background.secondary,
  }),
  rowHeader: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  children: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
    paddingLeft: theme.spacing(5),
    paddingTop: theme.spacing(0.75),
  }),
  childRow: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.default,
    '&:hover': {
      background: theme.colors.background.canvas,
    },
  }),
});
