import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';

export interface ChatDashboardModalProps {
  dashboard: DashboardModel;
  onDismiss: () => void;
  onSaveSuccess?: () => void;
}
