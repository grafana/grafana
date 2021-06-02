import { Alert } from '../Alerts.types';

export interface AlertsActionsProps {
  alert: Alert;
  getAlerts: () => void;
}
