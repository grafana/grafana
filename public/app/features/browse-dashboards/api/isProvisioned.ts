import { Folder } from 'app/api/clients/folder/v1beta1';
import { AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { DashboardDTO } from 'app/types/dashboard';

import { DashboardWithAccessInfo } from '../../dashboard/api/types';

export function isProvisionedDashboard(dashboard: DashboardDTO | DashboardWithAccessInfo<unknown>) {
  const annotations = 'meta' in dashboard ? dashboard.meta.k8s?.annotations : dashboard.metadata.annotations;
  return annotations?.[AnnoKeyManagerKind] === ManagerKind.Repo;
}

export function isProvisionedFolder(folder: Folder) {
  return folder.metadata.annotations?.[AnnoKeyManagerKind] === ManagerKind.Repo;
}
