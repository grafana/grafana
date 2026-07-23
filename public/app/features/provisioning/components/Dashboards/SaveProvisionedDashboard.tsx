import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Button, Stack } from '@grafana/ui';
import { SaveDashboardAsForm } from 'app/features/dashboard-scene/saving/SaveDashboardAsForm';
import { type SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { type DashboardChangeInfo } from 'app/features/dashboard-scene/saving/shared';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { type DashboardMeta } from 'app/types/dashboard';

import { RepoViewStatus } from '../../hooks/useGetResourceRepositoryView';
import { useProvisionedDashboardData } from '../../hooks/useProvisionedDashboardData';
import { ProvisionedFormGate } from '../ProvisionedFormGate';

import { SaveProvisionedDashboardForm } from './SaveProvisionedDashboardForm';

export interface SaveProvisionedDashboardProps {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
  saveAsCopy?: boolean;
}

export function SaveProvisionedDashboard({ drawer, changeInfo, dashboard, saveAsCopy }: SaveProvisionedDashboardProps) {
  const { isNew, defaultValues, canPushToConfiguredBranch, readOnly, repository, repoDataStatus, error } =
    useProvisionedDashboardData(dashboard, saveAsCopy);
  const [saveToDatabase, setSaveToDatabase] = useState(false);
  const [canSaveToDatabaseInstead, setCanSaveToDatabaseInstead] = useState(false);
  const dbSwitchRef = useRef<{ active: boolean; gitMeta?: DashboardMeta; savedUid?: string }>({ active: false });

  // changeInfo.isNew stays stable across repo resolution; the hook's isNew flips false on error
  const isNewDashboard = changeInfo.isNew || !!saveAsCopy;

  const isDeadEnd = repoDataStatus === RepoViewStatus.Error || repoDataStatus === RepoViewStatus.Orphaned;

  // Keep the escape available for folderless repos and whenever a new dashboard dead-ends
  useEffect(() => {
    if (repository) {
      setCanSaveToDatabaseInstead(repository.target === 'folderless' && isNewDashboard);
    } else if (isDeadEnd && isNewDashboard) {
      setCanSaveToDatabaseInstead(true);
    }
  }, [repository, isDeadEnd, isNewDashboard]);

  // Restore the git-flow meta so database-form folder picks (folderUid and manager annotations)
  // don't leak back into the provisioned form. Skip it when a save moved the uid on: that meta stands.
  const restoreGitMeta = useCallback(() => {
    const { active, gitMeta, savedUid } = dbSwitchRef.current;
    if (active && gitMeta && dashboard.state.meta.uid === savedUid) {
      dashboard.setState({ meta: gitMeta });
    }
    dbSwitchRef.current.active = false;
  }, [dashboard]);

  // Cancel in the database form bypasses drawer.onClose, so restore on unmount too
  useEffect(() => {
    return () => restoreGitMeta();
  }, [restoreGitMeta]);

  const handleSwitchToDatabase = () => {
    const meta = dashboard.state.meta;
    const folderUid = locationService.getSearchObject().folderUid;
    const entryFolderUid = typeof folderUid === 'string' ? folderUid : undefined;

    // Dead-ends go back to the folder the drawer resolved from, so switch-back lands on a working Git form
    const gitMeta = isDeadEnd ? { ...meta, folderUid: entryFolderUid, k8s: undefined } : { ...meta };
    dbSwitchRef.current = { active: true, savedUid: meta.uid, gitMeta };

    // Only an unmanaged folder is a valid database target; provisioned and orphaned ones are rejected
    if (repoDataStatus !== RepoViewStatus.Error) {
      dashboard.setState({ meta: { ...meta, folderUid: undefined } });
    }

    setSaveToDatabase(true);
  };

  const handleSwitchToGit = () => {
    restoreGitMeta();
    setSaveToDatabase(false);
  };

  // Latched on saveToDatabase alone: folder picks in the database form can make the repository
  // stop resolving, and that must not collapse this branch into the provisioning error gate
  if (saveToDatabase) {
    return (
      <Stack direction="column" gap={2}>
        <SaveDashboardAsForm dashboard={dashboard} changeInfo={changeInfo} />
        <SwitchSaveTargetButton onClick={handleSwitchToGit}>
          <Trans i18nKey="dashboard-scene.save-provisioned-dashboard.save-to-git">Save to Git repository instead</Trans>
        </SwitchSaveTargetButton>
      </Stack>
    );
  }

  return (
    <Stack direction="column" gap={2}>
      <ProvisionedFormGate
        isLoading={repoDataStatus === RepoViewStatus.Loading}
        isOrphaned={repoDataStatus === RepoViewStatus.Orphaned}
        isError={repoDataStatus === RepoViewStatus.Error || !defaultValues}
        error={error}
      >
        <SaveProvisionedDashboardForm
          dashboard={dashboard}
          drawer={drawer}
          changeInfo={changeInfo}
          isNew={isNew || !!saveAsCopy}
          defaultValues={defaultValues!}
          repository={repository}
          canPushToConfiguredBranch={canPushToConfiguredBranch}
          readOnly={readOnly}
          saveAsCopy={saveAsCopy}
        />
      </ProvisionedFormGate>
      {canSaveToDatabaseInstead && (
        <SwitchSaveTargetButton onClick={handleSwitchToDatabase}>
          <Trans i18nKey="dashboard-scene.save-provisioned-dashboard.save-to-database">
            Save to Grafana database instead
          </Trans>
        </SwitchSaveTargetButton>
      )}
    </Stack>
  );
}

function SwitchSaveTargetButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <div>
      <Button variant="secondary" size="sm" fill="text" onClick={onClick}>
        {children}
      </Button>
    </div>
  );
}
