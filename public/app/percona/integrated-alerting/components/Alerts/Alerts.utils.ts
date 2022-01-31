import moment from 'moment/moment';
import { Alert, AlertsListResponseLabel, AlertsListResponseAlert, AlertStatus, AlertLabels } from './Alerts.types';
import { AlertRuleSeverity } from '../AlertRules/AlertRules.types';
import { PRIMARY_LABELS, HIDDEN_LABELS } from './Alerts.constants';
import { formatRule } from '../AlertRules/AlertRules.utils';

export const formatLabel = (label: [string, string]): string => {
  const [key, value] = label;

  return `${key}=${value}`;
};

export const formatLabels = (labels: AlertsListResponseLabel): AlertLabels => {
  const alertLabels: AlertLabels = {
    primary: [],
    secondary: [],
  };

  Object.entries(labels).forEach(([key, value]) => {
    const formattedLabel = formatLabel([key, value]);

    if (PRIMARY_LABELS.includes(key)) {
      alertLabels.primary.push(formattedLabel);
    } else if (!HIDDEN_LABELS.includes(key)) {
      alertLabels.secondary.push(formattedLabel);
    }
  });

  return alertLabels;
};

export const formatAlert = (alert: AlertsListResponseAlert): Alert => {
  const { alert_id, created_at, labels, updated_at, severity, status, summary, rule } = alert;

  return {
    alertId: alert_id,
    activeSince: created_at ? moment(created_at).format('YYYY-MM-DD HH:mm:ss.SSS') : '',
    labels: formatLabels(labels),
    severity: AlertRuleSeverity[severity],
    status: AlertStatus[status],
    summary,
    lastNotified: updated_at ? moment(updated_at).format('YYYY-MM-DD HH:mm:ss.SSS') : '',
    rule: rule ? formatRule(rule) : undefined,
  };
};

export const formatAlerts = (alerts: AlertsListResponseAlert[]): Alert[] => (alerts ? alerts.map(formatAlert) : []);
