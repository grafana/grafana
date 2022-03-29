import moment from 'moment/moment';
import { formatLabels } from 'app/percona/shared/helpers/labels';
import { Alert, AlertsListResponseAlert, AlertStatus } from './Alerts.types';
import { AlertRuleSeverity } from '../AlertRules/AlertRules.types';
import { formatRule } from '../AlertRules/AlertRules.utils';

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
