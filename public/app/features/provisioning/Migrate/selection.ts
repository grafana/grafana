import { API_GROUP as DASHBOARD_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { type ResourceRef } from 'app/api/clients/provisioning/v0alpha1';

import { type FolderRow } from './hooks/useFolderMigrationData';

/**
 * Summary of what the user has picked in the Dashboards to migrate table.
 * `items` counts the user's ticks (folders + dashboards selected on their own)
 * for the button label; `dashboards` is the resolved set of dashboard refs the
 * migrate job actually receives.
 */
export interface MigrationSelection {
  /** Folders explicitly ticked. */
  folders: number;
  /** Dashboards that end up in the migrate payload (folder subtrees + lone dashboards). */
  dashboards: number;
  /** Folders + independently-ticked dashboards, for the "Migrate selected (N)" label. */
  items: number;
  /** The dashboard refs to send to the migrate job. */
  resources: ResourceRef[];
}

/**
 * Resolves the table selection into the migrate job payload.
 *
 * Folders aren't accepted by the migrate job directly, so a selected folder
 * cascades to every dashboard in its subtree (`allDashboards`, which the hook
 * already filters down to unmanaged dashboards). Individually-ticked dashboards
 * are added on top, de-duplicated against the ones a selected folder already
 * covers — so picking a folder *and* a dashboard inside it counts that
 * dashboard once.
 */
export function resolveSelection(
  folders: FolderRow[],
  selectedFolderUids: Set<string>,
  selectedDashboardUids: Set<string>
): MigrationSelection {
  const seen = new Set<string>();
  const resources: ResourceRef[] = [];
  const addDashboard = (uid: string) => {
    if (seen.has(uid)) {
      return;
    }
    seen.add(uid);
    resources.push({ name: uid, group: DASHBOARD_GROUP, kind: 'Dashboard' });
  };

  // Dashboards covered by a selected folder are tracked separately so we don't
  // double-count them in the "items" tally below.
  const folderCoveredDashboardUids = new Set<string>();
  for (const folder of folders) {
    if (selectedFolderUids.has(folder.uid)) {
      folder.allDashboards.forEach((d) => folderCoveredDashboardUids.add(d.uid));
    }
  }

  folderCoveredDashboardUids.forEach(addDashboard);
  selectedDashboardUids.forEach(addDashboard);

  const independentDashboards = Array.from(selectedDashboardUids).filter(
    (uid) => !folderCoveredDashboardUids.has(uid)
  ).length;

  return {
    folders: selectedFolderUids.size,
    dashboards: resources.length,
    items: selectedFolderUids.size + independentDashboards,
    resources,
  };
}
