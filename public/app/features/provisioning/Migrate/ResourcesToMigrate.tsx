import { css } from '@emotion/css';
import { type ReactNode, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Checkbox, Combobox, EmptyState, FilterInput, Stack, Text, useStyles2 } from '@grafana/ui';

import { FolderEntry } from './FolderEntry';
import { type FolderRow, resourceKey } from './hooks/useMigrationData';
import { type SortKey, compareFolders } from './sorting';

interface Props {
  /**
   * Folder rows to migrate. Kinds that don't support folders (e.g. playlists)
   * are grouped under a synthetic folder row by the caller, so this component
   * stays kind-agnostic.
   */
  folders: FolderRow[];
  selectedFolderUids: Set<string>;
  /** Composite keys (see `resourceKey`) of individually-ticked resources. */
  selectedResourceKeys: Set<string>;
  onToggleFolder: (uid: string) => void;
  onToggleResource: (key: string) => void;
  /** Folders + independently-ticked resources, shown in the migrate button. */
  selectedCount: number;
  /** True when every migratable folder is selected — drives the "Migrate all" label. */
  allSelected: boolean;
  /** Selects or deselects a batch of folders — used by the (filter-scoped) select-all. */
  onSetFoldersSelected: (uids: string[], selected: boolean) => void;
  onMigrateSelected: () => void;
  /** Whether the current selection can be migrated. False when nothing is selected. */
  submitDisabled: boolean;
  /**
   * Whether migration is possible — i.e. a repository that can push to its
   * configured branch is connected. When false the footer shows `connectAction`
   * instead of the (otherwise dead) migrate button.
   */
  canMigrate: boolean;
  /** Reachable "connect a repository" action, shown when `canMigrate` is false. */
  connectAction: ReactNode;
}

/**
 * Foldable, searchable list of folders that hold resources to migrate. A whole
 * folder or individual resources can be selected; the migrate footer action
 * hands the selection to the migrate drawer. The hook only surfaces folders with
 * unmanaged resources directly inside them, so empty and already-managed folders
 * never appear here.
 */
export function ResourcesToMigrate({
  folders,
  selectedFolderUids,
  selectedResourceKeys,
  onToggleFolder,
  onToggleResource,
  selectedCount,
  allSelected,
  onSetFoldersSelected,
  onMigrateSelected,
  submitDisabled,
  canMigrate,
  connectAction,
}: Props) {
  const styles = useStyles2(getStyles);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('count-desc');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = !q
      ? folders.slice()
      : folders.filter((folder) => {
          if (folder.title.toLowerCase().includes(q)) {
            return true;
          }
          return folder.directResources.some((r) => r.title.toLowerCase().includes(q));
        });
    matched.sort((a, b) => compareFolders(a, b, sortKey));
    return matched;
  }, [folders, search, sortKey]);

  // Resources inside a selected folder appear ticked but can't be toggled
  // individually — the user deselects the folder first. Recomputed here (never
  // stored) so deselecting one folder doesn't strip resources covered by
  // another.
  const folderCoveredResourceKeys = useMemo(() => {
    const covered = new Set<string>();
    for (const folder of folders) {
      if (selectedFolderUids.has(folder.uid)) {
        folder.directResources.forEach((r) => covered.add(resourceKey(r)));
      }
    }
    return covered;
  }, [folders, selectedFolderUids]);

  // Select-all is scoped to the rows currently shown (after search), matching
  // standard table behaviour — it never reaches past the filter to tick the
  // whole instance.
  const filteredFolderUids = filtered.map((folder) => folder.uid);
  const allFilteredSelected =
    filteredFolderUids.length > 0 && filteredFolderUids.every((uid) => selectedFolderUids.has(uid));
  const someFilteredSelected = filteredFolderUids.some((uid) => selectedFolderUids.has(uid));

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
    <div className={styles.panel}>
      <Stack direction="column" gap={0.5}>
        <Text variant="h5">
          <Trans i18nKey="provisioning.migrate.resources-to-migrate-heading">Resources to migrate</Trans>
        </Text>
        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="provisioning.migrate.resources-to-migrate-subtitle">
            Pick whole folders, or individual resources within them. Selecting a folder migrates only the resources
            directly inside it — anything in subfolders migrates through its own folder.
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

      {filtered.length > 0 && (
        <div className={styles.selectAllRow}>
          <Checkbox
            // Checkbox only ever sets the native `indeterminate` property to
            // true and never clears it, so once this box has been partially
            // selected it would stay visually indeterminate even after every
            // row is selected. Drive the property ourselves so it resets to a
            // plain checked state when all visible rows are selected.
            ref={(el) => {
              if (el) {
                el.indeterminate = someFilteredSelected && !allFilteredSelected;
              }
            }}
            value={allFilteredSelected}
            indeterminate={someFilteredSelected && !allFilteredSelected}
            onChange={() => onSetFoldersSelected(filteredFolderUids, !allFilteredSelected)}
            label={t('provisioning.migrate.resources-select-all', 'Select all')}
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          variant="not-found"
          message={
            folders.length === 0
              ? t(
                  'provisioning.migrate.resources-to-migrate-all-managed',
                  'All supported resources are already managed by Git.'
                )
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
              selectedResourceKeys={selectedResourceKeys}
              folderCoveredResourceKeys={folderCoveredResourceKeys}
              onToggleExpanded={() => toggleExpanded(folder.uid)}
              onToggleFolder={() => onToggleFolder(folder.uid)}
              onToggleResource={onToggleResource}
            />
          ))}
        </div>
      )}

      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between" wrap>
        <Text variant="bodySmall" color="secondary">
          {t('provisioning.migrate.resources-to-migrate-footer', '', {
            // Plural agrees with the total folder count (the noun), not the
            // number of rows shown.
            shown: filtered.length,
            count: folders.length,
            defaultValue_one: 'Showing {{shown}} of {{count}} folder',
            defaultValue_other: 'Showing {{shown}} of {{count}} folders',
          })}
        </Text>
        {folders.length > 0 &&
          (canMigrate ? (
            <Button variant="primary" icon="upload" onClick={onMigrateSelected} disabled={submitDisabled}>
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
          ) : (
            connectAction
          ))}
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
});
