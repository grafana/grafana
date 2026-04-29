import { css, cx } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Checkbox,
  EmptyState,
  FilterInput,
  Icon,
  IconButton,
  LinkButton,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { type Repository } from 'app/api/clients/provisioning/v0alpha1';

import { GETTING_STARTED_URL, PROVISIONING_URL } from '../constants';

import { type FolderDashboard, type FolderRow } from './hooks/useFolderLeaderboard';

function migrateTarget(repos: Repository[]): string {
  if (repos.length === 0) {
    return GETTING_STARTED_URL;
  }
  if (repos.length === 1 && repos[0].metadata?.name) {
    return `${PROVISIONING_URL}/${repos[0].metadata.name}`;
  }
  return PROVISIONING_URL;
}

interface Props {
  folders: FolderRow[];
  repos: Repository[];
  selectedFolders: Set<string>;
  onToggleFolder: (uid: string) => void;
}

/**
 * Expandable folder list with inline dashboard selection. The actual cross-folder
 * "selected folders" set is owned by the parent so QuickWinsPanel can stay in
 * sync with it; per-dashboard selections are local to this component.
 */
export function FoldersToMigrate({ folders, repos, selectedFolders, onToggleFolder }: Props) {
  const styles = useStyles2(getStyles);
  const [search, setSearch] = useState('');
  const [onlyUnmanaged, setOnlyUnmanaged] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedDashboards, setSelectedDashboards] = useState<Record<string, Set<string>>>({});

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

  const totalSelectedDashboards = useMemo(
    () => Object.values(selectedDashboards).reduce((acc, set) => acc + set.size, 0),
    [selectedDashboards]
  );

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

  const toggleDashboard = (folderUid: string, dashboardUid: string) => {
    setSelectedDashboards((prev) => {
      const next = { ...prev };
      const set = new Set(next[folderUid] ?? []);
      if (set.has(dashboardUid)) {
        set.delete(dashboardUid);
      } else {
        set.add(dashboardUid);
      }
      if (set.size === 0) {
        delete next[folderUid];
      } else {
        next[folderUid] = set;
      }
      return next;
    });
  };

  const target = migrateTarget(repos);
  const totalSelectedFolders = selectedFolders.size;
  const hasAnySelection = totalSelectedFolders > 0 || totalSelectedDashboards > 0;

  return (
    <div className={styles.panel} id="folders-to-migrate">
      <Stack direction="column" gap={0.5}>
        <Text variant="h5">
          <Trans i18nKey="provisioning.stats.folders-to-migrate-heading">Folders to migrate</Trans>
        </Text>
        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="provisioning.stats.folders-to-migrate-subtitle">
            Browse folders, expand a folder to pick individual dashboards, or migrate the whole folder in one go.
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
        <div className={styles.list}>
          {filtered.map((folder) => (
            <FolderRowView
              key={folder.uid}
              folder={folder}
              isExpanded={expanded.has(folder.uid)}
              isSelected={selectedFolders.has(folder.uid)}
              selectedDashboardUids={selectedDashboards[folder.uid] ?? new Set()}
              onToggleExpanded={() => toggleExpanded(folder.uid)}
              onToggleSelected={() => onToggleFolder(folder.uid)}
              onToggleDashboard={(dashUid) => toggleDashboard(folder.uid, dashUid)}
              repos={repos}
            />
          ))}
        </div>
      )}

      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between" wrap>
        <Text variant="bodySmall" color="secondary">
          {t('provisioning.stats.folders-to-migrate-footer', 'Showing {{count}} of {{total}} folders', {
            count: filtered.length,
            total: folders.length,
          })}
        </Text>
        {hasAnySelection && (
          <LinkButton variant="primary" size="sm" icon="upload" href={target}>
            {t('provisioning.stats.folders-to-migrate-bulk-cta', 'Migrate selected ({{count}})', {
              count: totalSelectedFolders + totalSelectedDashboards,
            })}
          </LinkButton>
        )}
      </Stack>
    </div>
  );
}

interface FolderRowViewProps {
  folder: FolderRow;
  isExpanded: boolean;
  isSelected: boolean;
  selectedDashboardUids: Set<string>;
  onToggleExpanded: () => void;
  onToggleSelected: () => void;
  onToggleDashboard: (dashboardUid: string) => void;
  repos: Repository[];
}

function FolderRowView({
  folder,
  isExpanded,
  isSelected,
  selectedDashboardUids,
  onToggleExpanded,
  onToggleSelected,
  onToggleDashboard,
  repos,
}: FolderRowViewProps) {
  const styles = useStyles2(getStyles);
  const target = migrateTarget(repos);
  const pct = folder.dashboardCount === 0 ? 0 : Math.round((folder.managedDashboardCount / folder.dashboardCount) * 100);

  return (
    <div className={cx(styles.row, isSelected && styles.rowSelected)}>
      <div className={styles.rowHeader}>
        <IconButton
          name={isExpanded ? 'angle-down' : 'angle-right'}
          aria-label={
            isExpanded
              ? t('provisioning.stats.folders-collapse', 'Collapse {{folder}}', { folder: folder.title })
              : t('provisioning.stats.folders-expand', 'Expand {{folder}}', { folder: folder.title })
          }
          onClick={onToggleExpanded}
        />
        <Checkbox
          value={isSelected}
          onChange={onToggleSelected}
          aria-label={t('provisioning.stats.folders-select', 'Select folder {{folder}}', { folder: folder.title })}
        />
        <Icon name="folder" />
        <Stack direction="column" gap={0} flex={1}>
          <Text>{folder.title}</Text>
          <Text variant="bodySmall" color="secondary">
            {t(
              'provisioning.stats.folders-row-summary',
              '{{count}} dashboards · {{managed}} managed ({{pct}}%)',
              {
                count: folder.dashboardCount,
                managed: folder.managedDashboardCount,
                pct,
              }
            )}
          </Text>
        </Stack>
        <LinkButton variant="secondary" size="sm" icon="upload" href={target}>
          <Trans i18nKey="provisioning.stats.folders-migrate-folder">Migrate folder</Trans>
        </LinkButton>
      </div>
      {isExpanded && (
        <DashboardListView
          dashboards={folder.dashboards}
          selected={selectedDashboardUids}
          onToggle={onToggleDashboard}
          target={target}
        />
      )}
    </div>
  );
}

interface DashboardListViewProps {
  dashboards: FolderDashboard[];
  selected: Set<string>;
  onToggle: (uid: string) => void;
  target: string;
}

function DashboardListView({ dashboards, selected, onToggle, target }: DashboardListViewProps) {
  const styles = useStyles2(getStyles);
  if (dashboards.length === 0) {
    return (
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="provisioning.stats.folders-empty-dashboards">No dashboards in this folder.</Trans>
      </Text>
    );
  }
  const selectedInFolder = dashboards.filter((d) => selected.has(d.uid)).length;
  return (
    <div className={styles.dashList}>
      {dashboards.map((d) => {
        const checked = selected.has(d.uid);
        return (
          <label key={d.uid} className={styles.dashRow}>
            <Checkbox
              value={checked}
              onChange={() => onToggle(d.uid)}
              aria-label={d.title}
              disabled={Boolean(d.managedBy)}
            />
            <Text variant="bodySmall">{d.title}</Text>
            <div className={styles.spacer} />
            {d.managedBy ? (
              <Text variant="bodySmall" color="secondary">
                {t('provisioning.stats.folders-managed-by', 'Managed by {{kind}}', { kind: d.managedBy })}
              </Text>
            ) : (
              <Text variant="bodySmall" color="warning">
                <Trans i18nKey="provisioning.stats.folders-unmanaged-tag">Unmanaged</Trans>
              </Text>
            )}
          </label>
        );
      })}
      {selectedInFolder > 0 && (
        <LinkButton variant="primary" size="sm" icon="upload" href={target}>
          {t('provisioning.stats.folders-migrate-selected', 'Migrate {{count}} selected', {
            count: selectedInFolder,
          })}
        </LinkButton>
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
  list: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  row: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
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
  dashList: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    paddingLeft: theme.spacing(5),
  }),
  dashRow: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    '&:hover': {
      background: theme.colors.background.canvas,
    },
  }),
  spacer: css({
    flex: '1 1 auto',
  }),
});
