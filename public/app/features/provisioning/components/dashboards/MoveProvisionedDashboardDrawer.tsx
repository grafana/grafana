import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { useProvisionedDashboardData } from '../hooks';

import { MoveProvisionedDashboardForm } from './MoveProvisionedDashboardForm';

export interface Props {
  dashboard: DashboardScene;
  targetFolderUID?: string;
  targetFolderTitle?: string;
  onDismiss: () => void;
  onSuccess: (folderUID: string, folderTitle: string) => void;
}

export function MoveProvisionedDashboardDrawer({
  dashboard,
  targetFolderUID,
  targetFolderTitle,
  onDismiss,
  onSuccess,
}: Props) {
  const { defaultValues, loadedFromRef, readOnly, workflowOptions, isNew, repository } =
    useProvisionedDashboardData(dashboard);

  if (!defaultValues) {
    return null;
  }

  return (
    <MoveProvisionedDashboardForm
      dashboard={dashboard}
      defaultValues={defaultValues}
      loadedFromRef={loadedFromRef}
      readOnly={readOnly}
      repository={repository}
      isNew={isNew}
      workflowOptions={workflowOptions}
      targetFolderUID={targetFolderUID}
      targetFolderTitle={targetFolderTitle}
      onDismiss={onDismiss}
      onSuccess={onSuccess}
    />
  );
}
