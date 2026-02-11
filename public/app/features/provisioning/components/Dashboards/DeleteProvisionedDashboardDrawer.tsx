import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { useProvisionedDashboardData } from '../../hooks/useProvisionedDashboardData';

import { DeleteProvisionedDashboardForm } from './DeleteProvisionedDashboardForm';

export interface Props {
  dashboard: DashboardScene;
  onDismiss: () => void;
}

/**
 * @description
 * Drawer component for deleting a git provisioned dashboard.
 */
export function DeleteProvisionedDashboardDrawer({ dashboard, onDismiss }: Props) {
  const { defaultValues, loadedFromRef, readOnly, canPushToConfiguredBranch, isNew, repository } =
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
      canPushToConfiguredBranch={canPushToConfiguredBranch}
      onDismiss={onDismiss}
    />
  );
}
