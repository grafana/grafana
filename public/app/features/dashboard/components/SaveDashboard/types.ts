import { type ObjectMeta } from 'app/features/apiserver/types';
import { type CloneOptions } from 'app/features/dashboard/state/DashboardModel';

export interface SaveDashboardOptions extends CloneOptions {
  folderUid?: string;
  overwrite?: boolean;
  message?: string;
  makeEditable?: boolean;
  // for schema v2 we need to pass the k8s metadata
  k8s?: Partial<ObjectMeta>;
}

export interface SaveDashboardAsOptions {
  saveAsCopy?: boolean;
  isNew?: boolean;
  copyTags?: boolean;
  title?: string;
  description?: string;
}

export interface SaveDashboardCommand<T> {
  dashboard: T;
  message?: string;
  folderUid?: string;
  overwrite?: boolean;
  showErrorAlert?: boolean;

  // When loading dashboards from k8s, we need to have access to the metadata wrapper
  k8s?: Partial<ObjectMeta>;
}
