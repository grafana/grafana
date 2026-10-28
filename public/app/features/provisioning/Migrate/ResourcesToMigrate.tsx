import { css } from '@emotion/css';
import { type ReactNode, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Checkbox, Combobox, EmptyState, FilterInput, Pagination, Stack, Text, useStyles2 } from '@grafana/ui';

import { FolderEntry } from './FolderEntry';
import { type FolderRow, resourceKey } from './hooks/useMigrationData';
import { type SortKey } from './sorting';
import {
  type FolderNode,
  buildFolderTree,
  filterFolderTree,
  searchExpandedUids,
  selectableUids,
  sortFolderTree,
  subtreeSelectableUids,
} from './tree';

/** Top-level folders shown per page before pagination kicks in. */
const PAGE_SIZE = 10;

interface Props {
  /**
   * Folder rows to migrate. Kinds that don't support folders (e.g. playlists)
   * are grouped under a synthetic folder row by the caller, so this component
   * stays kind-agnostic.
   */
  folders: FolderRow[];
  /**
   * Resource-less ancestors of `folders`, shown only so subfolders nest under
   * their parents. They are never selectable on their own.
   */
  containers?: FolderRow[];
  selectedFolderUids: Set<string>;
  /** Composite keys (see `resourceKey`) of individually-ticked resources. */
  selectedResourceKeys: Set<string>;
  onToggleResource: (key: string) => void;
  /** Selects or deselects a batch of individually-ticked resources by composite key. */
  onSetResourcesSelected: (keys: string[], selected: boolean) => void;
  /** Folders + independently-ticked resources, shown in the migrate button. */
  selectedCount: number;
  /** True when every migratable folder is selected — drives the "Migrate all" label. */
  allSelected: boolean;
  /** Selects or deselects a batch of folders — used by select-all and by a folder's subtree. */
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
 * Foldable, searchable tree of folders that hold resources to migrate. A whole
 * folder or individual resources can be selected; selecting a folder also selects
 * every folder beneath it. The migrate footer action
 * hands the selection to the migrate drawer. The hook only surfaces folders with
 * unmanaged resources somewhere beneath them, so empty and already-managed
 * folders never appear here.
 */
export function ResourcesToMigrate({
  folders,
  containers = [],
  selectedFolderUids,
  selectedResourceKeys,
  onToggleResource,
  onSetResourcesSelected,
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
  // Folders the user flipped from their search default (opened or closed) during
  // the current search; reset when the query changes.
  const [searchFlipped, setSearchFlipped] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('count-desc');
  const [page, setPage] = useState(1);

  const tree = useMemo(() => buildFolderTree([...folders, ...containers]), [folders, containers]);
  const filtered = useMemo(() => sortFolderTree(filterFolderTree(tree, search), sortKey), [tree, search, sortKey]);

  // Built from the unfiltered tree so ticking a folder reaches subfolders a
  // search is hiding.
  const { subtreeUids, subtreeResourceKeys } = useMemo(() => {
    const uidsByFolder = new Map<string, string[]>();
    const keysByFolder = new Map<string, string[]>();
    const walk = (node: FolderNode): string[] => {
      const keys = [...node.row.directResources.map(resourceKey), ...node.children.flatMap(walk)];
      uidsByFolder.set(node.row.uid, subtreeSelectableUids(node));
      keysByFolder.set(node.row.uid, keys);
      return keys;
    };
    tree.forEach(walk);
    return { subtreeUids: uidsByFolder, subtreeResourceKeys: keysByFolder };
  }, [tree]);

  const setSubtreesSelected = (rootUids: string[], selected: boolean) => {
    const folderUids = new Set(rootUids.flatMap((uid) => subtreeUids.get(uid) ?? [uid]));
    onSetFoldersSelected([...folderUids], selected);
    if (!selected) {
      onSetResourcesSelected(
        rootUids.flatMap((uid) => subtreeResourceKeys.get(uid) ?? []),
        false
      );
    }
  };

  // While searching, the folders leading to a match open so it is visible
  // without clicking down through each level. The user can still flip any folder.
  const isSearching = search.trim() !== '';
  const visibleExpanded = useMemo(() => {
    if (!isSearching) {
      return expanded;
    }
    const open = new Set(searchExpandedUids(filtered, search));
    searchFlipped.forEach((uid) => {
      if (open.has(uid)) {
        open.delete(uid);
      } else {
        open.add(uid);
      }
    });
    return open;
  }, [isSearching, filtered, search, expanded, searchFlipped]);

  // Clamp the page so it stays valid when the filtered set shrinks (e.g. after
  // a search) without needing an effect to reset it.
  const numberOfPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, numberOfPages);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  // 1-based range of matching folders visible on the current page, shown in the
  // footer so the count stays honest once only a page's worth of rows renders.
  // Only read when there's at least one match (the footer is hidden otherwise).
  const rangeStart = (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = (currentPage - 1) * PAGE_SIZE + paged.length;

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

  // Select-all covers the whole filtered set — every matching folder across all
  // pages, not just the page on screen — matching standard table behaviour
  // where search narrows the target but pagination doesn't. It never reaches
  // past the filter to tick the whole instance, except for the subfolders of a
  // matching folder, which a folder tick selects too.
  const filteredFolderUids = selectableUids(filtered);
  const allFilteredSelected =
    filteredFolderUids.length > 0 && filteredFolderUids.every((uid) => selectedFolderUids.has(uid));

  const toggleExpanded = (uid: string) => {
    const flip = (prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    };
    if (isSearching) {
      setSearchFlipped(flip);
    } else {
      setExpanded(flip);
    }
  };

  return (
    <div className={styles.panel}>
      <Stack direction="column" gap={0.5}>
        <Text variant="h5">
          <Trans i18nKey="provisioning.migrate.resources-to-migrate-heading">Resources to migrate</Trans>
        </Text>
        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="provisioning.migrate.resources-to-migrate-subtitle">
            Pick whole folders, or individual resources within them. Selecting a folder also selects everything in its
            subfolders.
          </Trans>
        </Text>
      </Stack>

      <Stack direction="row" gap={1} alignItems="center" wrap>
        <div className={styles.searchInput}>
          <FilterInput
            placeholder={t('provisioning.migrate.resources-to-migrate-search', 'Search folders and resources')}
            value={search}
            // Matching is by substring, not regex, so escaping would break names like "user-1".
            escapeRegex={false}
            onChange={(value) => {
              setSearch(value);
              setSearchFlipped(new Set());
              setPage(1);
            }}
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
                setPage(1);
              }
            }}
            aria-label={t('provisioning.migrate.resources-sort-aria', 'Sort folders')}
          />
        </div>
      </Stack>

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
          <div className={styles.selectAllRow}>
            <Checkbox
              value={allFilteredSelected}
              onChange={() => setSubtreesSelected(filteredFolderUids, !allFilteredSelected)}
              label={t('provisioning.migrate.resources-select-all', 'Select all')}
            />
          </div>
          {paged.map((node) => (
            <FolderEntry
              key={node.row.uid}
              node={node}
              depth={0}
              expanded={visibleExpanded}
              selectedFolderUids={selectedFolderUids}
              selectedResourceKeys={selectedResourceKeys}
              folderCoveredResourceKeys={folderCoveredResourceKeys}
              onToggleExpanded={toggleExpanded}
              subtreeUids={subtreeUids}
              onSetFolderSelected={(uid, selected) => setSubtreesSelected([uid], selected)}
              onToggleResource={onToggleResource}
            />
          ))}
        </div>
      )}

      {numberOfPages > 1 && (
        <Stack justifyContent="flex-end">
          <Pagination currentPage={currentPage} numberOfPages={numberOfPages} onNavigate={setPage} />
        </Stack>
      )}

      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between" wrap>
        {/* Skipped when nothing matches so it doesn't read "0–0 of 0" under the empty state. */}
        {filtered.length > 0 && (
          <Text variant="bodySmall" color="secondary">
            {t('provisioning.migrate.resources-to-migrate-footer', '', {
              // Plural agrees with the total matching folder count (the noun), not
              // the size of the visible page range.
              from: rangeStart,
              to: rangeEnd,
              count: filtered.length,
              defaultValue_one: 'Showing {{from}}–{{to}} of {{count}} folder',
              defaultValue_other: 'Showing {{from}}–{{to}} of {{count}} folders',
            })}
          </Text>
        )}
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
  // Header row of the list, matching the dashboard list's header.
  selectAllRow: css({
    display: 'flex',
    alignItems: 'center',
    height: 36,
    padding: theme.spacing(0, 1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  list: css({
    display: 'flex',
    flexDirection: 'column',
  }),
});
