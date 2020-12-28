import moment from 'moment/moment';
import { Alert, AlertsListResponseLabel, AlertsListResponseAlert, AlertStatus } from '../Alerts.types';
import { AlertRuleSeverity } from '../../AlertRules/AlertRules.types';

export const formatLabel = (label: [string, string]): string => {
  const [key, value] = label;

  return `${key}=${value}`;
};

export const formatLabels = (labels: AlertsListResponseLabel): string[] => {
  return Object.entries(labels).map(formatLabel);
};

export const formatAlert = (rule: AlertsListResponseAlert): Alert => {
  const { alert_id, created_at, labels, updated_at, severity, status, summary } = rule;

  return {
    alertId: alert_id,
    activeSince: created_at ? moment(created_at).format('YYYY-MM-DD HH:mm:ss.SSS') : '',
    labels: formatLabels(labels),
    severity: AlertRuleSeverity[severity],
    status: AlertStatus[status],
    summary,
    lastNotified: updated_at ? moment(updated_at).format('YYYY-MM-DD HH:mm:ss.SSS') : '',
  };
};

export const formatAlerts = (alerts: AlertsListResponseAlert[]): Alert[] => (alerts ? alerts.map(formatAlert) : []);
