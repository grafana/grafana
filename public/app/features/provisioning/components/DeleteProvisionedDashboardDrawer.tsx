import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { DeleteProvisionedDashboardForm } from './DeleteProvisionedDashboardForm';
import { useProvisionedDashboardData } from './hooks';

export interface Props {
  dashboard: DashboardScene;
  onDismiss: () => void;
}

/**
 * @description
 * Drawer component for deleting a git provisioned dashboard.
 */
export function DeleteProvisionedDashboardDrawer({ dashboard, onDismiss }: Props) {
  const { defaultValues, loadedFromRef, readOnly, workflowOptions, isNew, repository } =
    useProvisionedDashboardData(dashboard);

  if (!defaultValues) {
    return null;
  }

  return (
    <DeleteProvisionedDashboardForm
      dashboard={dashboard}
      defaultValues={defaultValues}
      loadedFromRef={loadedFromRef}
      readOnly={readOnly}
      repository={repository}
      isNew={isNew}
      workflowOptions={workflowOptions}
      onDismiss={onDismiss}
    />
  );
}
