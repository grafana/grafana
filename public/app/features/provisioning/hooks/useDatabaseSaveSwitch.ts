import { useCallback, useEffect, useState } from 'react';

import { locationService } from '@grafana/runtime';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { type SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { RepoViewStatus } from './useGetResourceRepositoryView';

interface UseDatabaseSaveSwitchArgs {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
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
 * The switch state lives on the drawer, not in this hook: opening the Changes tab unmounts the
 * save form while the drawer stays open, and coming back to Details must land on the same form.
 *
 * Three invariants live here:
 * - Switching snapshots the meta the Git form needs, so switch-back lands on a form that resolves.
 * - The snapshot is one-shot: switch-back or drawer close consumes it, never twice.
 * - A completed save owns the resulting meta, so the switch is not undone afterwards.
 */
export function useDatabaseSaveSwitch({
  dashboard,
  drawer,
  repository,
  repoDataStatus,
  isNewDashboard,
}: UseDatabaseSaveSwitchArgs): DatabaseSaveSwitch {
  const { saveToDatabase = false } = drawer.useState();
  const [canSwitch, setCanSwitch] = useState(false);

  const isDeadEnd = repoDataStatus === RepoViewStatus.Error || repoDataStatus === RepoViewStatus.Orphaned;

  // Keep the escape available for folderless repos and whenever a new dashboard dead-ends
  useEffect(() => {
    if (repository) {
      setCanSwitch(repository.target === 'folderless' && isNewDashboard);
    } else if (isDeadEnd && isNewDashboard) {
      setCanSwitch(true);
    }
  }, [repository, isDeadEnd, isNewDashboard]);

  // Consumes the snapshot, so the switch can only ever be undone once
  const takeSnapshot = useCallback(() => {
    const snapshot = drawer.state.databaseSwitchSnapshot;
    drawer.setState({ databaseSwitchSnapshot: undefined });
    return snapshot;
  }, [drawer]);

  // Cancel in the database form bypasses drawer.onClose, so undo the switch on unmount, but only
  // when the drawer really closed: a tab switch unmounts the form too and must keep the switch. New
  // dashboards and copies go back to their initial meta like onClose does, otherwise closing via
  // the drawer's X would put the provisioned fields it just cleared straight back.
  useEffect(() => {
    return () => {
      if (dashboard.state.overlay === drawer) {
        return;
      }
      const snapshot = takeSnapshot();
      if (!snapshot) {
        return;
      }
      // saveCompleted mints the uid and clears the overlay in the same setState, so a changed uid
      // means a save owns the current meta no matter which order the unmount and the save land in
      if (dashboard.state.uid !== snapshot.uid) {
        return;
      }
      const initialMeta = dashboard.getInitialState()?.meta;
      dashboard.setState({ meta: snapshot.wasNew && initialMeta ? initialMeta : snapshot.gitMeta });
    };
  }, [takeSnapshot, dashboard, drawer]);

  const switchToDatabase = useCallback(() => {
    const meta = dashboard.state.meta;
    const folderUid = locationService.getSearchObject().folderUid;
    const entryFolderUid = typeof folderUid === 'string' ? folderUid : undefined;

    // Only a Ready repo has a trustworthy folder; anything else restores the entry folder so switch-back lands on a working Git form
    const gitMeta =
      repoDataStatus === RepoViewStatus.Ready
        ? { ...meta }
        : { ...meta, folderUid: entryFolderUid, folderTitle: undefined, k8s: undefined };
    drawer.setState({
      saveToDatabase: true,
      databaseSwitchSnapshot: { gitMeta, wasNew: isNewDashboard, uid: dashboard.state.uid },
    });

    // Only an unmanaged folder is a valid database target; provisioned and orphaned ones are rejected.
    // Manager annotations go with it, or saveCompleted would carry them into the saved database dashboard.
    if (repoDataStatus !== RepoViewStatus.Error) {
      dashboard.setState({ meta: { ...meta, folderUid: undefined, folderTitle: undefined, k8s: undefined } });
    }
  }, [dashboard, drawer, isNewDashboard, repoDataStatus]);

  const switchToGit = useCallback(() => {
    const snapshot = takeSnapshot();
    if (snapshot) {
      dashboard.setState({ meta: snapshot.gitMeta });
    }
    drawer.setState({ saveToDatabase: false });
  }, [dashboard, drawer, takeSnapshot]);

  return { saveToDatabase, canSwitch, switchToDatabase, switchToGit };
}
