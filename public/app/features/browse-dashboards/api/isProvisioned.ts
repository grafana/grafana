import { type Folder } from 'app/api/clients/folder/v1beta1';
import { isManagedByRepository } from 'app/features/provisioning/utils/managedResource';
import { type DashboardDTO } from 'app/types/dashboard';

import { type DashboardWithAccessInfo } from '../../dashboard/api/types';

export function isProvisionedDashboard(dashboard: DashboardDTO | DashboardWithAccessInfo<unknown>) {
  const annotations = 'meta' in dashboard ? dashboard.meta.k8s?.annotations : dashboard.metadata.annotations;
  return isManagedByRepository({ metadata: { annotations } });
}

export function isProvisionedFolder(folder: Folder) {
  return isManagedByRepository(folder);
}
