import { config } from '@grafana/runtime';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind } from 'app/features/apiserver/types';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { type RepositoryViewData, useGetResourceRepositoryView } from './useGetResourceRepositoryView';

export interface DashboardRepositoryView extends RepositoryViewData {
  isLoading: boolean;
  /** New dashboard or Save As copy: a new file is written, so the target folder decides the repository */
  isNewSave: boolean;
  /** The save must go through a repository */
  isProvisioned: boolean;
}

/**
 * Resolves the repository a dashboard save targets. A stored dashboard resolves from its own manager
 * annotation. A new save resolves from the folder it is headed to (meta.folderUid, seeded from the URL
 * and updated by the save form's folder picker), falling back to a folderless or instance repository at
 * the root. Its manager annotation, if any, names the repository a previewed or copied file came from
 * and applies until a folder pick drops it (nextMetaAfterFolderPick).
 */
export function useDashboardRepositoryView(dashboard: DashboardScene, saveAsCopy?: boolean): DashboardRepositoryView {
  const { uid, meta } = dashboard.useState();
  // A save-as copy writes a new file even though the source dashboard already exists. A stored
  // dashboard has both a uid and a k8s name; a new one has neither before its first save.
  const isNewSave = Boolean(saveAsCopy) || (!uid && !meta.k8s?.name);
  const annotations = meta.k8s?.annotations;
  const managerName = annotations?.[AnnoKeyManagerKind] === 'repo' ? annotations[AnnoKeyManagerIdentity] : undefined;
  const view = useGetResourceRepositoryView({
    name: managerName,
    folderName: isNewSave ? meta.folderUid || undefined : undefined,
    includeFolderless: isNewSave && !meta.folderUid,
  });

  if (!config.provisioningEnabled) {
    return { ...view, isLoading: false, isNewSave, isProvisioned: false };
  }
  return {
    ...view,
    isLoading: Boolean(view.isLoading),
    isNewSave,
    // A stored dashboard's annotations settle it without waiting on the lookup; a new save has no file
    // to be managed yet, so only the lookup can say
    isProvisioned:
      (!isNewSave && dashboard.isManagedRepository()) || Boolean(view.repository) || view.isInstanceManaged,
  };
}
