import { type ReactNode } from 'react';

import { Trans } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';
import { SaveDashboardAsForm } from 'app/features/dashboard-scene/saving/SaveDashboardAsForm';
import { type SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { type DashboardChangeInfo } from 'app/features/dashboard-scene/saving/shared';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { useDatabaseSaveSwitch } from '../../hooks/useDatabaseSaveSwitch';
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
  const { defaultValues, canPushToConfiguredBranch, readOnly, repository, repoDataStatus, error } =
    useProvisionedDashboardData(dashboard, saveAsCopy);

  // changeInfo.isNew stays stable across repo resolution, unlike the data hook's isNew
  const isNewDashboard = changeInfo.isNew || !!saveAsCopy;

  const { saveToDatabase, canSwitch, switchToDatabase, switchToGit } = useDatabaseSaveSwitch({
    dashboard,
    repository,
    repoDataStatus,
    isNewDashboard,
  });

  // Latched on saveToDatabase alone: folder picks in the database form can make the repository
  // stop resolving, and that must not collapse this branch into the provisioning error gate
  if (saveToDatabase) {
    return (
      <Stack direction="column" gap={2}>
        <SaveDashboardAsForm dashboard={dashboard} changeInfo={changeInfo} />
        <SwitchSaveTargetButton onClick={switchToGit}>
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
          isNew={isNewDashboard}
          defaultValues={defaultValues!}
          repository={repository}
          canPushToConfiguredBranch={canPushToConfiguredBranch}
          readOnly={readOnly}
          saveAsCopy={saveAsCopy}
        />
      </ProvisionedFormGate>
      {canSwitch && (
        <SwitchSaveTargetButton onClick={switchToDatabase}>
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
