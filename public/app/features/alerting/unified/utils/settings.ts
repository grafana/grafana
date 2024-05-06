import { AlertmanagerChoice, GrafanaAlertingConfiguration } from 'app/plugins/datasource/alertmanager/types';

// if we have either "internal" or "both" configured this means the internal Alertmanager is receiving Grafana-managed alerts
export const isInternalAlertmanagerInterestedInAlerts = (config?: GrafanaAlertingConfiguration): boolean => {
  switch (config?.alertmanagersChoice) {
    case AlertmanagerChoice.Internal:
    case AlertmanagerChoice.All:
      return true;
    case AlertmanagerChoice.External:
    default:
      return false;
  }
};
