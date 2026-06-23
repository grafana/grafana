import { type ResourceRef } from 'app/api/clients/provisioning/v0alpha1';

import { resourceKindInfos } from '../utils/resourceKinds';

import { type FolderRow } from './hooks/useFolderMigrationData';
import { type PlaylistRow } from './hooks/usePlaylistMigrationData';

/**
 * Summary of what the user has picked in the Resources to migrate table.
 * `items` counts the user's ticks (folders + resources selected on their own)
 * for the button label; `resources` is the resolved set of resource refs the
 * migrate job actually receives.
 */
export interface MigrationSelection {
  /** Folders explicitly ticked. */
  folders: number;
  /** Folders + independently-ticked resources, for the "Migrate selected (N)" label. */
  items: number;
  /** The resource refs to send to the migrate job (dashboards and playlists). */
  resources: ResourceRef[];
}

const DASHBOARD = resourceKindInfos.dashboard;
const PLAYLIST = resourceKindInfos.playlist;

/**
 * Resolves the table selection into the migrate job payload.
 *
 * Folders aren't accepted by the migrate job directly, and selective migration
 * isn't recursive, so a selected folder cascades only to the dashboards
 * directly inside it (`directDashboards`, already filtered to unmanaged ones).
 * Individually-ticked dashboards are added on top, de-duplicated against the
 * ones a selected folder already covers — so picking a folder *and* a dashboard
 * inside it counts that dashboard once. Playlists aren't folder-scoped, so each
 * ticked playlist maps directly to a ref.
 */
export function resolveSelection(
  folders: FolderRow[],
  selectedFolderUids: Set<string>,
  selectedDashboardUids: Set<string>,
  selectedPlaylistUids: Set<string> = new Set()
): MigrationSelection {
  const resources: ResourceRef[] = [];

  const seenDashboards = new Set<string>();
  const addDashboard = (uid: string) => {
    if (seenDashboards.has(uid)) {
      return;
    }
    seenDashboards.add(uid);
    resources.push({ name: uid, group: DASHBOARD.group, kind: DASHBOARD.kind });
  };

  // Dashboards covered by a selected folder are tracked separately so we don't
  // double-count them in the "items" tally below.
  const folderCoveredDashboardUids = new Set<string>();
  for (const folder of folders) {
    if (selectedFolderUids.has(folder.uid)) {
      folder.directDashboards.forEach((d) => folderCoveredDashboardUids.add(d.uid));
    }
  }

  folderCoveredDashboardUids.forEach(addDashboard);
  selectedDashboardUids.forEach(addDashboard);

  selectedPlaylistUids.forEach((uid) => {
    resources.push({ name: uid, group: PLAYLIST.group, kind: PLAYLIST.kind });
  });

  const independentDashboards = Array.from(selectedDashboardUids).filter(
    (uid) => !folderCoveredDashboardUids.has(uid)
  ).length;

  return {
    folders: selectedFolderUids.size,
    items: selectedFolderUids.size + independentDashboards + selectedPlaylistUids.size,
    resources,
  };
}
