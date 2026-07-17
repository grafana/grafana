import { type ReactNode, useRef, useState } from 'react';

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
  const gitFolderUidRef = useRef<string | undefined>(undefined);

  const canSaveToDatabaseInstead = repository?.target === 'folderless' && (isNew || !!saveAsCopy);

  const handleSwitchToDatabase = () => {
    gitFolderUidRef.current = dashboard.state.meta.folderUid;
    setSaveToDatabase(true);
  };

  const handleSwitchToGit = () => {
    // Restore the git-flow folder so the repository resolves again after database folder picks
    dashboard.setState({ meta: { ...dashboard.state.meta, folderUid: gitFolderUidRef.current } });
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
    <ProvisionedFormGate
      isLoading={repoDataStatus === RepoViewStatus.Loading}
      isOrphaned={repoDataStatus === RepoViewStatus.Orphaned}
      isError={repoDataStatus === RepoViewStatus.Error || !defaultValues}
      error={error}
    >
      <Stack direction="column" gap={2}>
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
        {canSaveToDatabaseInstead && (
          <SwitchSaveTargetButton onClick={handleSwitchToDatabase}>
            <Trans i18nKey="dashboard-scene.save-provisioned-dashboard.save-to-database">
              Save to Grafana database instead
            </Trans>
          </SwitchSaveTargetButton>
        )}
      </Stack>
    </ProvisionedFormGate>
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
