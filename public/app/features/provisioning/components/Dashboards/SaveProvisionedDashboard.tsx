import { useRef, type ReactNode } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';
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

import { FormLoadingErrorAlert } from './FormLoadingErrorAlert';
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

  // Same check the data hook does, read from meta directly: the hook reports isNew as false
  // whenever the repository is not Ready, which is when the escape hatch is needed most
  const isNewDashboard = getIsNewDashboardSave(meta, saveAsCopy);

  // Hold the data behind the form that is already on screen, or a folder pick putting the repository
  // back into loading would unmount that form and drop what the user typed into it
  const shownData = useRef<ProvisionedDashboardData | undefined>(undefined);
  const isReresolving = resolvedData.repoDataStatus === RepoViewStatus.Loading && Boolean(shownData.current);
  // A dead-end pick must not unmount a new save's form either: the folder picker inside it is the
  // only control that can undo the pick that caused the dead end, so the form stays up and the dead
  // end is reported next to it instead of in place of it
  const resolvedToDeadEnd =
    resolvedData.repoDataStatus === RepoViewStatus.Orphaned || resolvedData.repoDataStatus === RepoViewStatus.Error;
  const isHoldingThroughDeadEnd = isNewDashboard && resolvedToDeadEnd && Boolean(shownData.current);
  const data = isReresolving || isHoldingThroughDeadEnd ? shownData.current! : resolvedData;
  const { defaultValues, canPushToConfiguredBranch, readOnly, repository, repoDataStatus, error } = data;

  // The switch works off the real resolution, not the held one: a dead-end pick behind a held form
  // must still offer the escape, and its snapshot must not trust the folder that caused the dead end
  const { saveToDatabase, canSwitch, switchToDatabase, switchToGit } = useDatabaseSaveSwitch({
    dashboard,
    drawer,
    repository: resolvedData.repository,
    repoDataStatus: resolvedData.repoDataStatus,
    isNewDashboard,
  });

  const isLoading = repoDataStatus === RepoViewStatus.Loading;
  const isOrphaned = repoDataStatus === RepoViewStatus.Orphaned;
  const isError = repoDataStatus === RepoViewStatus.Error || !defaultValues;

  // Only the form is worth holding, and only while it is the branch on screen. Holding anything else
  // would bring a dead end back as the answer to the next lookup, in place of its spinner
  shownData.current = !saveToDatabase && !isLoading && !isOrphaned && !isError ? data : undefined;

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
      {isHoldingThroughDeadEnd &&
        (resolvedData.repoDataStatus === RepoViewStatus.Orphaned ? (
          <Alert
            severity="warning"
            title={t(
              'dashboard-scene.save-provisioned-dashboard.folder-repo-missing-title',
              'The selected folder cannot be saved to'
            )}
          >
            <Trans i18nKey="dashboard-scene.save-provisioned-dashboard.folder-repo-missing-body">
              The provisioning repository managing this folder no longer exists. Choose a different folder or save at
              the repository root.
            </Trans>
          </Alert>
        ) : (
          <FormLoadingErrorAlert error={resolvedData.error} />
        ))}
      <ProvisionedFormGate isLoading={isLoading} isOrphaned={isOrphaned} isError={isError} error={error}>
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
          isReresolving={isReresolving || isHoldingThroughDeadEnd}
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
