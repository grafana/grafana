import { CloneOptions, DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { DashboardDataDTO } from 'app/types';

import { Diffs } from '../VersionHistory/utils';

export interface SaveDashboardData {
  clone: DashboardModel; // cloned copy
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

export interface SaveDashboardCommand {
  dashboard: DashboardDataDTO;
  message?: string;
  folderUid?: string;
  overwrite?: boolean;
}

export interface SaveDashboardFormProps {
  dashboard: DashboardModel;
  onCancel: () => void;
  onSuccess: () => void;
  onSubmit?: (clone: DashboardModel, options: SaveDashboardOptions, dashboard: DashboardModel) => Promise<any>;
}

export interface SaveDashboardModalProps {
  dashboard: DashboardModel;
  onDismiss: () => void;
  onSaveSuccess?: () => void;
  isCopy?: boolean;
}
