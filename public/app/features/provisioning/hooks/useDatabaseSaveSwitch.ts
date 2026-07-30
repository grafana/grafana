import { useCallback, useEffect, useRef, useState } from 'react';

import { locationService } from '@grafana/runtime';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { appEvents } from 'app/core/app_events';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { type DashboardMeta } from 'app/types/dashboard';
import { DashboardSavedEvent } from 'app/types/events';

import { RepoViewStatus } from './useGetResourceRepositoryView';

interface UseDatabaseSaveSwitchArgs {
  dashboard: DashboardScene;
  repository?: RepositoryView;
  repoDataStatus: RepoViewStatus;
  /** Must stay stable across repository resolution, so it cannot come from repo-derived data */
  isNewDashboard: boolean;
}

export interface DatabaseSaveSwitch {
  saveToDatabase: boolean;
  canSwitch: boolean;
  switchToDatabase: () => void;
  switchToGit: () => void;
}

/**
 * Owns the "save to Grafana database instead" escape hatch for provisioned dashboard saves.
 *
 * Three invariants live here:
 * - Switching snapshots the meta the Git form needs, so switch-back lands on a form that resolves.
 * - The snapshot is one-shot: it can be undone by switch-back or unmount, never twice.
 * - A completed save owns the resulting meta, so the switch is not undone afterwards.
 */
export function useDatabaseSaveSwitch({
  dashboard,
  repository,
  repoDataStatus,
  isNewDashboard,
}: UseDatabaseSaveSwitchArgs): DatabaseSaveSwitch {
  const [saveToDatabase, setSaveToDatabase] = useState(false);
  const [canSwitch, setCanSwitch] = useState(false);
  const pendingSwitchRef = useRef<{ active: boolean; gitMeta?: DashboardMeta; wasNew?: boolean }>({ active: false });

  const isDeadEnd = repoDataStatus === RepoViewStatus.Error || repoDataStatus === RepoViewStatus.Orphaned;

  // Keep the escape available for folderless repos and whenever a new dashboard dead-ends
  useEffect(() => {
    if (repository) {
      setCanSwitch(repository.target === 'folderless' && isNewDashboard);
    } else if (isDeadEnd && isNewDashboard) {
      setCanSwitch(true);
    }
  }, [repository, isDeadEnd, isNewDashboard]);

  // The database form replaces meta wholesale on a folder pick, so a completed save can't be
  // inferred from meta itself.
  useEffect(() => {
    const sub = appEvents.subscribe(DashboardSavedEvent, () => {
      pendingSwitchRef.current.active = false;
    });
    return () => sub.unsubscribe();
  }, []);

  // Consumes a pending switch, so it can only ever be undone once
  const takePendingSwitch = useCallback(() => {
    const pending = pendingSwitchRef.current;
    pendingSwitchRef.current = { active: false };
    return pending.active ? pending : undefined;
  }, []);

  // Cancel in the database form bypasses drawer.onClose, so undo the switch on unmount too. New
  // dashboards and copies go back to their initial meta like onClose does, otherwise closing via
  // the drawer's X would put the provisioned fields it just cleared straight back.
  useEffect(() => {
    return () => {
      const pending = takePendingSwitch();
      if (!pending?.gitMeta) {
        return;
      }
      const initialMeta = dashboard.getInitialState()?.meta;
      dashboard.setState({ meta: pending.wasNew && initialMeta ? initialMeta : pending.gitMeta });
    };
  }, [takePendingSwitch, dashboard]);

  const switchToDatabase = useCallback(() => {
    const meta = dashboard.state.meta;
    const folderUid = locationService.getSearchObject().folderUid;
    const entryFolderUid = typeof folderUid === 'string' ? folderUid : undefined;

    // Only a Ready repo has a trustworthy folder; anything else restores the entry folder so switch-back lands on a working Git form
    const gitMeta =
      repoDataStatus === RepoViewStatus.Ready ? { ...meta } : { ...meta, folderUid: entryFolderUid, k8s: undefined };
    pendingSwitchRef.current = { active: true, gitMeta, wasNew: isNewDashboard };

    // Only an unmanaged folder is a valid database target; provisioned and orphaned ones are rejected.
    // Manager annotations go with it, or saveCompleted would carry them into the saved database dashboard.
    if (repoDataStatus !== RepoViewStatus.Error) {
      dashboard.setState({ meta: { ...meta, folderUid: undefined, k8s: undefined } });
    }

    setSaveToDatabase(true);
  }, [dashboard, isNewDashboard, repoDataStatus]);

  const switchToGit = useCallback(() => {
    const pending = takePendingSwitch();
    if (pending?.gitMeta) {
      dashboard.setState({ meta: pending.gitMeta });
    }
    setSaveToDatabase(false);
  }, [dashboard, takePendingSwitch]);

  return { saveToDatabase, canSwitch, switchToDatabase, switchToGit };
}
