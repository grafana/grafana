import { CloneOptions, DashboardModel } from 'app/features/dashboard/state/DashboardModel';

export interface SaveDashboardOptions extends CloneOptions {
  folderId?: number;
  overwrite?: boolean;
  message?: string;
  makeEditable?: boolean;
}

export interface SaveDashboardFormProps {
  dashboard: DashboardModel;
  onCancel: () => void;
  onSuccess: () => void;
  onSubmit?: (clone: any, options: SaveDashboardOptions, dashboard: DashboardModel) => Promise<any>;
}

export interface SaveDashboardModalProps {
  dashboard: DashboardModel;
  onDismiss: () => void;
  onSaveSuccess?: () => void;
}
