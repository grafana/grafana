import { API_GROUP as FOLDER_BUCKET } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { type ResourceStats } from 'app/api/clients/provisioning/v0alpha1';

import { type ResourceKindInfo, resourceKindInfos } from '../utils/resourceKinds';

// `folders` is the legacy storage group; the app-platform group is FOLDER_BUCKET.
// Folders are the only kind the stats endpoint reports under two group names.
const FOLDER_GROUPS: string[] = [FOLDER_BUCKET, 'folders'];

/** Total and managed counts for a single resource type, shown in a KPI card. */
export interface MigrationTotals {
  instanceTotal: number;
  managed: number;
}

/** Per-kind totals: the kind plus its instance/managed counts. */
export interface KindTotals {
  kind: ResourceKindInfo;
  totals: MigrationTotals;
}

/** Managed vs total folder counts, used for the empty/all-managed checks. */
export interface FolderCounts {
  managed: number;
  total: number;
}

/**
 * Sums total and managed counts for the stats entries that match a kind. A kind
 * is identified by BOTH group and resource: a group like `dashboard.grafana.app`
 * also exposes other resources (e.g. `librarypanels`, `variables`), which must
 * not be counted as dashboards. Managed means anything already owned by a
 * manager (Git Sync or another tool), so it isn't a migration candidate.
 */
function totalsForKind(data: ResourceStats | undefined, kind: ResourceKindInfo): MigrationTotals {
  let instanceTotal = 0;
  let managed = 0;
  data?.instance?.forEach((c) => {
    if (c.group === kind.group && c.resource === kind.resource) {
      instanceTotal += c.count;
    }
  });
  data?.managed?.forEach((m) => {
    m.stats.forEach((s) => {
      if (s.group === kind.group && s.resource === kind.resource) {
        managed += s.count;
      }
    });
  });
  return { instanceTotal, managed };
}

/**
 * Per-kind totals for the supplied kinds, in the same order. Driving the KPI
 * cards off the active kinds keeps the overview generic — a newly enabled kind
 * gets a card without touching this file.
 */
export function computeKindTotals(data: ResourceStats | undefined, kinds: ResourceKindInfo[]): KindTotals[] {
  return kinds.map((kind) => ({ kind, totals: totalsForKind(data, kind) }));
}

/**
 * Managed and total folder counts. Folders aren't a migratable content kind in
 * the table (they're the container others nest under), but the count still gates
 * the empty/all-managed states, so it's computed separately and folds the legacy
 * `folders` group into the app-platform one.
 */
export function computeFolderCounts(data: ResourceStats | undefined): FolderCounts {
  const isFolder = (group: string, resource: string) =>
    FOLDER_GROUPS.includes(group) && resource === resourceKindInfos.folder.resource;

  let total = 0;
  let managed = 0;
  data?.instance?.forEach((c) => {
    if (isFolder(c.group, c.resource)) {
      total += c.count;
    }
  });
  data?.managed?.forEach((m) => {
    m.stats.forEach((s) => {
      if (isFolder(s.group, s.resource)) {
        managed += s.count;
      }
    });
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
