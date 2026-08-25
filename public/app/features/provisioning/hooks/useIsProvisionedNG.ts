import { config } from '@grafana/runtime';

import { type DashboardScene } from '../../dashboard-scene/scene/DashboardScene';

import { useGetResourceRepositoryView } from './useGetResourceRepositoryView';
import { getIsNewDashboardSave } from './useProvisionedDashboardData';

export interface ProvisionedNGState {
  isProvisioned: boolean;
  /** Repository resolution is still in flight, so isProvisioned is not yet meaningful */
  isLoading: boolean;
}

export function useIsProvisionedNG(dashboard: DashboardScene, saveAsCopy?: boolean): ProvisionedNGState {
  // Subscribed here rather than read off state, so the lookup re-resolves when the save form
  // changes the folder without relying on the caller to subscribe
  const { uid, meta } = dashboard.useState();
  // Built on the shared predicate so it cannot drift from the other save paths. The extra uid
  // term is this hook's own: a stored dashboard resolves its repository from its own annotations,
  // so neither identity may be present before a folder or folderless lookup is triggered
  const isNewDashboard = !uid && getIsNewDashboardSave(meta);
  // A save-as copy writes a new file, so it resolves the folder/root like a new dashboard: the
  // source's own annotations describe where the source lives, not where the copy is headed
  const isNewSave = isNewDashboard || Boolean(saveAsCopy);
  // meta.folderUid is seeded from the URL for new dashboards and then tracks the folder picked in
  // the save form, so this resolves the same folder useDefaultValues does
  const folderName = isNewSave ? meta.folderUid || undefined : undefined;

  const { repository, isInstanceManaged, isLoading } = useGetResourceRepositoryView({
    folderName,
    includeFolderless: !folderName && isNewSave,
  });

  // The config flag wins over everything, even repo-managed annotations on the dashboard itself
  if (!config.provisioningEnabled) {
    return { isProvisioned: false, isLoading: false };
  }

  // The dashboard's own annotations settle this without waiting on the repository lookup
  if (dashboard.isManagedRepository()) {
    return { isProvisioned: true, isLoading: false };
  }

  return { isProvisioned: Boolean(repository) || isInstanceManaged, isLoading: Boolean(isLoading) };
}
