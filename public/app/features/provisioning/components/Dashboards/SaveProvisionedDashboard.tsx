import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { Trans } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { SaveDashboardAsForm } from 'app/features/dashboard-scene/saving/SaveDashboardAsForm';
import { type SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { type DashboardChangeInfo } from 'app/features/dashboard-scene/saving/shared';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { type DashboardMeta } from 'app/types/dashboard';
import { DashboardSavedEvent } from 'app/types/events';

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
  const dbSwitchRef = useRef<{ active: boolean; gitMeta?: DashboardMeta }>({ active: false });

  // changeInfo.isNew stays stable across repo resolution; the hook's isNew flips false on error
  const isNewDashboard = changeInfo.isNew || !!saveAsCopy;

  // Keep the escape available for folderless repos and whenever a new dashboard hits the error gate
  useEffect(() => {
    if (repository) {
      setCanSaveToDatabaseInstead(repository.target === 'folderless' && isNewDashboard);
    } else if (repoDataStatus === RepoViewStatus.Error && isNewDashboard) {
      setCanSaveToDatabaseInstead(true);
    }
  }, [repository, repoDataStatus, isNewDashboard]);

  // Restore the full git-flow meta so database-form folder picks (folderUid and manager
  // annotations) don't leak back into the provisioned form and rebind it to the wrong repo
  const restoreGitMeta = useCallback(() => {
    const { active, gitMeta } = dbSwitchRef.current;
    if (active && gitMeta) {
      dashboard.setState({ meta: gitMeta });
    }
    dbSwitchRef.current.active = false;
  }, [dashboard]);

  // A completed database save must not trigger the restore below
  useEffect(() => {
    const sub = appEvents.subscribe(DashboardSavedEvent, () => {
      dbSwitchRef.current.active = false;
    });
    return () => sub.unsubscribe();
  }, []);

  // Cancel in the database form bypasses drawer.onClose, so restore on unmount too
  useEffect(() => {
    return () => restoreGitMeta();
  }, [restoreGitMeta]);

  const handleSwitchToDatabase = () => {
    const meta = dashboard.state.meta;
    if (repository) {
      // The selected folder is provisioned and can't take a database save, so open the form at root
      dbSwitchRef.current = { active: true, gitMeta: { ...meta } };
      dashboard.setState({ meta: { ...meta, folderUid: undefined } });
    } else {
      // Dead-ended on an unmanaged folder pick: keep it (a valid database folder) and return to root on switch-back
      dbSwitchRef.current = { active: true, gitMeta: { ...meta, folderUid: undefined, k8s: undefined } };
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
