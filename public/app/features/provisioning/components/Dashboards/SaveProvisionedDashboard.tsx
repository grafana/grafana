import { useRef, type ReactNode } from 'react';

import { Trans } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';
import { SaveDashboardAsForm } from 'app/features/dashboard-scene/saving/SaveDashboardAsForm';
import { type SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { type DashboardChangeInfo } from 'app/features/dashboard-scene/saving/shared';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { useDatabaseSaveSwitch } from '../../hooks/useDatabaseSaveSwitch';
import { RepoViewStatus } from '../../hooks/useGetResourceRepositoryView';
import {
  getIsNewDashboardSave,
  useProvisionedDashboardData,
  type ProvisionedDashboardData,
} from '../../hooks/useProvisionedDashboardData';
import { ProvisionedFormGate } from '../ProvisionedFormGate';

import { SaveProvisionedDashboardForm } from './SaveProvisionedDashboardForm';

export interface SaveProvisionedDashboardProps {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
  saveAsCopy?: boolean;
}

export function SaveProvisionedDashboard({ drawer, changeInfo, dashboard, saveAsCopy }: SaveProvisionedDashboardProps) {
  const { meta } = dashboard.useState();
  const resolvedData = useProvisionedDashboardData(dashboard, saveAsCopy);

  // Hold the last settled result across a folder pick, or the spinner would unmount the form that is
  // already up and drop what the user typed into it
  const settledData = useRef<ProvisionedDashboardData | undefined>(undefined);
  const isReresolving = resolvedData.repoDataStatus === RepoViewStatus.Loading && Boolean(settledData.current);
  if (!isReresolving) {
    settledData.current = resolvedData;
  }
  const { defaultValues, canPushToConfiguredBranch, readOnly, repository, repoDataStatus, error } =
    settledData.current ?? resolvedData;

  // Same check the data hook does, read from meta directly: the hook reports isNew as false
  // whenever the repository is not Ready, which is when the escape hatch is needed most
  const isNewDashboard = getIsNewDashboardSave(meta, saveAsCopy);

  const { saveToDatabase, canSwitch, switchToDatabase, switchToGit } = useDatabaseSaveSwitch({
    dashboard,
    drawer,
    repository,
    repoDataStatus,
    isNewDashboard,
  });

  // Latched on saveToDatabase alone: folder picks in the database form can make the repository
  // stop resolving, and that must not collapse this branch into the provisioning error gate
  if (saveToDatabase) {
    return (
      <Stack direction="column" gap={2}>
        <SaveDashboardAsForm dashboard={dashboard} changeInfo={changeInfo} drawer={drawer} />
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
          isReresolving={isReresolving}
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
