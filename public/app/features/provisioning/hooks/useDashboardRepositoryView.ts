import { useRef } from 'react';

import { AnnoKeyManagerIdentity, AnnoKeyManagerKind } from 'app/features/apiserver/types';
import { isNewDashboard } from 'app/features/dashboard-scene/saving/shared';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { RepoViewStatus, type RepositoryViewData, useGetResourceRepositoryView } from './useGetResourceRepositoryView';

export interface DashboardRepositoryView extends Omit<RepositoryViewData, 'isLoading'> {
  /** New dashboard or Save As copy: a new file is written, so the target folder decides the repository */
  isNewSave: boolean;
  /** The save must go through a repository */
  isProvisioned: boolean;
  /** Folder the lookup ran for; undefined at the root. Decide from this, not live meta, so a pick still in flight cannot split a decision */
  folderUid?: string;
  /**
   * The live lookup has moved on (loading after a folder pick, or dead-ended for a new save on an orphaned
   * folder or a failed lookup) and has not replaced this view, so the form that is up survives the pick
   */
  isHeld: boolean;
  /** Where the live lookup stands: this view's own status and error unless it is held */
  lookup: Pick<RepositoryViewData, 'status' | 'error'>;
}

/**
 * Resolves the repository a dashboard save targets. A stored dashboard resolves from its own manager
 * annotation. A new save resolves from the folder it is headed to (meta.folderUid, seeded from the URL
 * and updated by the save form's folder picker), falling back to a folderless or instance repository at
 * the root. Its manager annotation, if any, names the repository a previewed or copied file came from
 * and applies until a folder pick drops it (nextMetaAfterFolderPick).
 */
export function useDashboardRepositoryView(dashboard: DashboardScene, saveAsCopy?: boolean): DashboardRepositoryView {
  const state = dashboard.useState();
  const isNewSave = Boolean(saveAsCopy) || isNewDashboard(state);
  const folderUid = state.meta.folderUid || undefined;
  const annotations = state.meta.k8s?.annotations;
  const managerName = annotations?.[AnnoKeyManagerKind] === 'repo' ? annotations[AnnoKeyManagerIdentity] : undefined;
  const live = useGetResourceRepositoryView({
    name: managerName,
    folderName: isNewSave ? folderUid : undefined,
    includeFolderless: isNewSave && !folderUid,
  });
  const settled = useRef<DashboardRepositoryView | undefined>(undefined);

  const lookup = { status: live.status, error: live.error };
  const current: DashboardRepositoryView = {
    ...live,
    isNewSave,
    folderUid,
    // A stored dashboard's annotations settle it without waiting on the lookup; a new save has no file
    // to be managed yet, so only the lookup can say. An instance repository is not counted on its own:
    // every Ready lookup that has one resolves it as `repository`, so the only view it would add is an
    // orphaned dead end, which must not route to a form with no folder picker
    isProvisioned: (!isNewSave && dashboard.isManagedRepository()) || Boolean(live.repository),
    isHeld: false,
    lookup,
  };
  // A folder pick re-runs the lookup. Hold the last settled view while it is in flight, and through a
  // dead end for a new save: the form that is up would otherwise unmount and drop what was typed, and
  // its folder picker is the only way out of the dead end
  const isDeadEnd = isNewSave && (live.status === RepoViewStatus.Orphaned || live.status === RepoViewStatus.Error);
  if (live.status !== RepoViewStatus.Loading && !(isDeadEnd && settled.current)) {
    settled.current = current;
    return current;
  }
  if (!settled.current) {
    // First lookup: nothing settled to hold
    return current;
  }
  return { ...settled.current, isHeld: true, lookup };
}
