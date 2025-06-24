import { useProvisionedDashboardData } from '../saving/provisioned/hooks';
import { DashboardScene } from '../scene/DashboardScene';

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
  const { defaultValues, loadedFromRef, readOnly, isGitHub, workflowOptions, isNew } =
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
      isGitHub={isGitHub}
      isNew={isNew}
      workflowOptions={workflowOptions}
      onDismiss={onDismiss}
    />
  );
}
