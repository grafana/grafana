import { type ReactNode, useEffect, useRef, useState } from 'react';

import { Trans } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';
import { SaveDashboardAsForm } from 'app/features/dashboard-scene/saving/SaveDashboardAsForm';
import { type SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { type DashboardChangeInfo } from 'app/features/dashboard-scene/saving/shared';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

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
  const dbSwitchRef = useRef<{ active: boolean; gitFolderUid?: string }>({ active: false });

  // Latched: the escape link must survive folder picks that make the repository stop resolving
  useEffect(() => {
    if (repository?.target === 'folderless' && (isNew || !!saveAsCopy)) {
      setCanSaveToDatabaseInstead(true);
    }
  }, [repository, isNew, saveAsCopy]);

  // Cancel in the database form bypasses drawer.onClose; restore the git-flow folder unless the save completed
  useEffect(() => {
    return () => {
      const { active, gitFolderUid } = dbSwitchRef.current;
      if (active && !dashboard.state.meta.uid) {
        dashboard.setState({ meta: { ...dashboard.state.meta, folderUid: gitFolderUid } });
      }
    };
  }, [dashboard]);

  const handleSwitchToDatabase = () => {
    // Only snapshot a folder the repository can resolve; otherwise fall back to root
    dbSwitchRef.current = { active: true, gitFolderUid: repository ? dashboard.state.meta.folderUid : undefined };
    setSaveToDatabase(true);
  };

  const handleSwitchToGit = () => {
    // Restore the git-flow folder so the repository resolves again after database folder picks
    dashboard.setState({ meta: { ...dashboard.state.meta, folderUid: dbSwitchRef.current.gitFolderUid } });
    dbSwitchRef.current.active = false;
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
