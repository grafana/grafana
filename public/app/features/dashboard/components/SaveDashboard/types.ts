import { Dashboard } from '@grafana/schema';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { ObjectMeta } from 'app/features/apiserver/types';
import { CloneOptions, DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { Diffs } from 'app/features/dashboard-scene/settings/version-history/utils';
import { SaveDashboardResponseDTO } from 'app/types';

export interface SaveDashboardData {
  clone: Dashboard; // cloned copy
  diff: Diffs;
  diffCount: number; // cumulative count
  hasChanges: boolean; // not new and has changes
}

export interface SaveDashboardOptions extends CloneOptions {
  folderUid?: string;
  overwrite?: boolean;
  message?: string;
  makeEditable?: boolean;
}

export interface SaveDashboardAsOptions {
  saveAsCopy?: boolean;
  isNew?: boolean;
  copyTags?: boolean;
  title?: string;
  description?: string;
}

export interface SaveDashboardCommand {
  dashboard: Dashboard | DashboardV2Spec;
  message?: string;
  folderUid?: string;
  overwrite?: boolean;
  showErrorAlert?: boolean;

  // When loading dashboards from k8s, we need to have access to the metadata wrapper
  k8s?: Partial<ObjectMeta>;
}

export interface SaveDashboardFormProps {
  dashboard: DashboardModel;
  isLoading: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  onSubmit?: (
    saveModel: Dashboard,
    options: SaveDashboardOptions,
    dashboard: DashboardModel
  ) => Promise<SaveDashboardResponseDTO>;
}

export interface SaveDashboardModalProps {
  dashboard: DashboardModel;
  onDismiss: () => void;
  onSaveSuccess?: () => void;
  isCopy?: boolean;
}
