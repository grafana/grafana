import { config } from '@grafana/runtime';

import { Folder } from '../../../api/clients/folder';
import { DashboardDTO } from '../../../types';
import { AnnoKeyManagerKind, ManagerKind } from '../../apiserver/types';
import { DashboardWithAccessInfo } from '../../dashboard/api/types';

export function isProvisionedDashboard(dashboard: DashboardDTO | DashboardWithAccessInfo<unknown>) {
  if (!config.featureToggles.provisioning) {
    return false;
  }
  const annotations = 'meta' in dashboard ? dashboard.meta.k8s?.annotations : dashboard.metadata.annotations;
  return annotations?.[AnnoKeyManagerKind] === ManagerKind.Repo;
}

export function isProvisionedFolder(folder: Folder) {
  return folder.metadata.annotations?.[AnnoKeyManagerKind] === ManagerKind.Repo;
}
