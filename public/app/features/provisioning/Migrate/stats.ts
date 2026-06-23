import { API_GROUP as DASHBOARD_BUCKET } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_BUCKET } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { type ManagerStats, type ResourceStats } from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';

import { resourceKindInfos } from '../utils/resourceKinds';

// The playlist group comes from the kind registry (its single source of truth)
// rather than re-importing the playlist API client here.
const PLAYLIST_BUCKET = resourceKindInfos.playlist.group;

// `folders` is the legacy storage group; the app-platform group is FOLDER_BUCKET.
const FOLDER_GROUPS: string[] = [FOLDER_BUCKET, 'folders'];
const DASHBOARD_GROUPS: string[] = [DASHBOARD_BUCKET];
const PLAYLIST_GROUPS: string[] = [PLAYLIST_BUCKET];

type BucketKey = typeof DASHBOARD_BUCKET | typeof FOLDER_BUCKET | typeof PLAYLIST_BUCKET;

/**
 * Classify a stats entry into the dashboard, folder, or playlist bucket, keyed
 * by BOTH group and resource. A group like `dashboard.grafana.app` also exposes
 * other resources (e.g. `variables`, `librarypanels`); those must not be counted
 * as dashboards. Anything that isn't a tracked resource is ignored.
 */
function bucketKeyFor(group: string, resource: string): BucketKey | undefined {
  if (DASHBOARD_GROUPS.includes(group) && resource === 'dashboards') {
    return DASHBOARD_BUCKET;
  }
  if (FOLDER_GROUPS.includes(group) && resource === 'folders') {
    return FOLDER_BUCKET;
  }
  if (PLAYLIST_GROUPS.includes(group) && resource === 'playlists') {
    return PLAYLIST_BUCKET;
  }
  return undefined;
}

export interface GroupBreakdown {
  group: string;
  total: number;
  gitSyncCount: number;
  otherManagedCount: number;
  unmanagedCount: number;
}

/** Per-resource-type totals shown in the KPI cards. */
export interface MigrationTotals {
  instanceTotal: number;
  managed: number;
}

/** Managed vs total folder counts shown in the "Folders managed" gauge. */
export interface FolderCounts {
  managed: number;
  total: number;
}

/**
 * Build per-type breakdowns for Folders and Dashboards from the API
 * response. Always emits one row per type even when the API doesn't
 * report any, so the cards read consistently.
 */
export function computeBreakdowns(data?: ResourceStats): GroupBreakdown[] {
  const seedKeys = [FOLDER_BUCKET, DASHBOARD_BUCKET, PLAYLIST_BUCKET];

  const map = new Map<string, GroupBreakdown>();
  for (const group of seedKeys) {
    map.set(group, {
      group,
      total: 0,
      gitSyncCount: 0,
      otherManagedCount: 0,
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
      }
    });
  });

  map.forEach((entry) => {
    entry.unmanagedCount = Math.max(0, entry.total - entry.gitSyncCount - entry.otherManagedCount);
  });

  return Array.from(map.values());
}

/**
 * Sum the total and managed counts across the breakdowns whose group is in
 * `groups`. Managed means anything already owned by a manager (Git Sync or
 * another tool), so it isn't a migration candidate.
 */
function aggregateTotals(breakdowns: GroupBreakdown[], groups: string[]): MigrationTotals {
  let instanceTotal = 0;
  let managed = 0;
  breakdowns
    .filter((b) => groups.includes(b.group))
    .forEach((b) => {
      instanceTotal += b.total;
      managed += b.gitSyncCount + b.otherManagedCount;
    });
  return { instanceTotal, managed };
}

export function aggregateDashboardTotals(breakdowns: GroupBreakdown[]): MigrationTotals {
  return aggregateTotals(breakdowns, DASHBOARD_GROUPS);
}

export function aggregatePlaylistTotals(breakdowns: GroupBreakdown[]): MigrationTotals {
  return aggregateTotals(breakdowns, PLAYLIST_GROUPS);
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
  // Floor rather than round so a partial migration never reads as 100% (e.g.
  // 999/1000 stays at 99%, not 100%).
  return `${Math.floor((part / total) * 100)}%`;
}
