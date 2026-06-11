import { API_GROUP as DASHBOARD_BUCKET } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_BUCKET } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { t } from '@grafana/i18n';
import { type ManagerStats, type ResourceStats } from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';

// `folders` is the legacy storage group; the app-platform group is FOLDER_BUCKET.
export const FOLDER_GROUPS: string[] = [FOLDER_BUCKET, 'folders'];
export const DASHBOARD_GROUPS: string[] = [DASHBOARD_BUCKET];

/**
 * Classify a stats entry into the dashboard or folder bucket, keyed by BOTH
 * group and resource. A group like `dashboard.grafana.app` also exposes other
 * resources (e.g. `variables`, `librarypanels`); those must not be counted as
 * dashboards. Anything that isn't a dashboard or folder is ignored.
 */
function bucketKeyFor(group: string, resource: string): typeof DASHBOARD_BUCKET | typeof FOLDER_BUCKET | undefined {
  if (DASHBOARD_GROUPS.includes(group) && resource === 'dashboards') {
    return DASHBOARD_BUCKET;
  }
  if (FOLDER_GROUPS.includes(group) && resource === 'folders') {
    return FOLDER_BUCKET;
  }
  return undefined;
}

export interface GroupBreakdown {
  group: string;
  resource: string;
  label: string;
  total: number;
  gitSyncCount: number;
  otherManagedCount: number;
  /** Counts of resources managed by each non-Git-Sync manager kind. */
  managedByKind: Record<string, number>;
  unmanagedCount: number;
}

/** Dashboard-level totals shown in the KPI cards. */
export interface MigrationTotals {
  instanceTotal: number;
  managed: number;
  unmanaged: number;
  gitSync: number;
}

/** Managed vs total folder counts shown in the "Folders managed" gauge. */
export interface FolderCounts {
  managed: number;
  total: number;
}

export function resourceLabel(group: string): string {
  if (FOLDER_GROUPS.includes(group)) {
    return t('provisioning.migrate.folders', 'Folders');
  }
  if (DASHBOARD_GROUPS.includes(group)) {
    return t('provisioning.migrate.dashboards', 'Dashboards');
  }
  return group;
}

/**
 * Build per-type breakdowns for Folders and Dashboards from the API
 * response. Always emits one row per type even when the API doesn't
 * report any, so the cards read consistently.
 */
export function computeBreakdowns(data?: ResourceStats): GroupBreakdown[] {
  const seedKeys = [FOLDER_BUCKET, DASHBOARD_BUCKET];
  const seedResources: Record<string, string> = {
    [FOLDER_BUCKET]: 'folders',
    [DASHBOARD_BUCKET]: 'dashboards',
  };

  const map = new Map<string, GroupBreakdown>();
  for (const group of seedKeys) {
    map.set(group, {
      group,
      resource: seedResources[group],
      label: resourceLabel(group),
      total: 0,
      gitSyncCount: 0,
      otherManagedCount: 0,
      managedByKind: {},
      unmanagedCount: 0,
    });
  }

  data?.instance?.forEach((c) => {
    const entry = map.get(bucketKeyFor(c.group, c.resource) ?? '');
    if (entry) {
      entry.total += c.count;
    }
  });

  data?.managed?.forEach((m: ManagerStats) => {
    const kind = m.kind ?? '';
    const isGitSync = kind === ManagerKind.Repo;
    m.stats.forEach((s) => {
      const entry = map.get(bucketKeyFor(s.group, s.resource) ?? '');
      if (!entry) {
        return;
      }
      if (isGitSync) {
        entry.gitSyncCount += s.count;
      } else {
        entry.otherManagedCount += s.count;
        entry.managedByKind[kind] = (entry.managedByKind[kind] ?? 0) + s.count;
      }
    });
  });

  map.forEach((entry) => {
    entry.unmanagedCount = Math.max(0, entry.total - entry.gitSyncCount - entry.otherManagedCount);
  });

  return Array.from(map.values());
}

export function aggregateTotals(breakdowns: GroupBreakdown[]): MigrationTotals {
  // The Migrate to GitOps page is dashboard-centric: the KPI row reports
  // dashboard counts (folders are tracked separately by the gauge card). Skip
  // non-dashboard groups so totals don't double-count.
  const dashboardBreakdowns = breakdowns.filter((b) => DASHBOARD_GROUPS.includes(b.group));
  let instanceTotal = 0;
  let managed = 0;
  let unmanaged = 0;
  let gitSync = 0;
  dashboardBreakdowns.forEach((b) => {
    instanceTotal += b.total;
    gitSync += b.gitSyncCount;
    managed += b.gitSyncCount + b.otherManagedCount;
    unmanaged += b.unmanagedCount;
  });
  return { instanceTotal, managed, unmanaged, gitSync };
}

/** Managed and total folder counts, derived from the folder breakdown. */
export function aggregateFolderCounts(breakdowns: GroupBreakdown[]): FolderCounts {
  const folderBreakdowns = breakdowns.filter((b) => FOLDER_GROUPS.includes(b.group));
  let total = 0;
  let managed = 0;
  folderBreakdowns.forEach((b) => {
    total += b.total;
    managed += b.gitSyncCount + b.otherManagedCount;
  });
  return { managed, total };
}

export function percent(part: number, total: number): string {
  if (total === 0) {
    return '0%';
  }
  return `${Math.round((part / total) * 100)}%`;
}
