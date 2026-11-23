import { type ReactNode } from 'react';

import { t } from '@grafana/i18n';
import { Spinner } from '@grafana/ui';
import { type SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { SaveProvisionedDashboardForm as ManagedDashboardNotice } from 'app/features/dashboard-scene/saving/SaveProvisionedDashboardForm';
import { type DashboardChangeInfo } from 'app/features/dashboard-scene/saving/shared';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { useDashboardRepositoryView } from '../../hooks/useDashboardRepositoryView';
import { RepoViewStatus } from '../../hooks/useGetResourceRepositoryView';
import { getSaveTarget, type SaveTarget } from '../../hooks/useSaveRepositoryView';
import { type RecoverToNewBranch } from '../../types';

import { FolderDeadEndAlert } from './FolderDeadEndAlert';
import { SaveProvisionedDashboard } from './SaveProvisionedDashboard';

interface Args {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
  saveAsCopy?: boolean;
  recoverToNewBranch?: RecoverToNewBranch;
  /** Where a new save at the root of a folderless repository goes; unset means wherever the lookup says. */
  saveTarget?: SaveTarget;
}

/**
 * What a repository contributes to the dashboard save drawer. Everything a repository decides is
 * resolved here, so the drawer asks once and renders what comes back rather than carrying the
 * lookup, the target and the per-case forms itself.
 */
export interface DashboardSaveSlot {
  /**
   * Replaces the drawer's form while a repository takes the save, and holds the wait while the
   * lookup is still settling. Undefined when the database takes it.
   */
  form?: ReactNode;
  /** The notice shown for a dashboard a manager owns that the UI cannot edit. */
  readOnlyNotice?: ReactNode;
  /** Shown above a new save's form, where the chosen folder leads nowhere a repository can write. */
  alert?: ReactNode;
  /** Drawer title for a dashboard a repository already owns. */
  title?: string;
  /** Whether the dashboard has never been saved — true for a copy, which is a new dashboard. */
  isNewSave: boolean;
  /** Whether a quota or similar holds the save back, which the database form reports too. */
  isHeld: boolean;
  /** Whether a repository, rather than the database, takes this save. */
  takesSave: boolean;
  /** Whether there is no editable diff to offer, because the UI cannot write this dashboard at all. */
  hidesDiff: boolean;
}

export function useDashboardSaveSlot({
  dashboard,
  drawer,
  changeInfo,
  saveAsCopy,
  recoverToNewBranch,
  saveTarget,
}: Args): DashboardSaveSlot {
  const { meta } = dashboard.useState();
  const view = useDashboardRepositoryView(dashboard, saveAsCopy);
  const { isNewSave, isHeld } = view;
  const target = getSaveTarget(view, saveTarget);
  const takesSave = target === 'repository';
  // Classic file provisioning, and anything else a manager owns that the UI has no write path for.
  const cannotBeEdited = dashboard.managedResourceCannotBeEdited();

  const form = takesSave ? (
    <SaveProvisionedDashboard
      dashboard={dashboard}
      changeInfo={changeInfo}
      drawer={drawer}
      saveAsCopy={saveAsCopy}
      recoverToNewBranch={recoverToNewBranch}
      view={view}
    />
  ) : // First lookup of a new save: nothing settled to hold, so the form waits.
  view.status === RepoViewStatus.Loading ? (
    <Spinner />
  ) : undefined;

  return {
    form,
    readOnlyNotice:
      meta.provisioned || cannotBeEdited ? (
        <ManagedDashboardNotice dashboard={dashboard} changeInfo={changeInfo} drawer={drawer} />
      ) : undefined,
    alert: isNewSave ? <FolderDeadEndAlert {...view.lookup} /> : undefined,
    title:
      !isNewSave && (meta.provisioned || view.isProvisioned)
        ? t('dashboard-scene.save-dashboard-drawer.tabs.title-provisioned', 'Provisioned dashboard')
        : undefined,
    isNewSave,
    isHeld,
    takesSave,
    hidesDiff: cannotBeEdited,
  };
}
