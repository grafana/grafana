import { AlertmanagerChoice, GrafanaAlertingConfiguration } from 'app/plugins/datasource/alertmanager/types';

// if we have either "internal" or "both" configured this means the internal Alertmanager is receiving Grafana-managed alerts
export const isInternalAlertmanagerInterestedInAlerts = (config?: GrafanaAlertingConfiguration): boolean => {
  if (!config) {
    // The backend doesn't have a configuration record in a new Grafana instance until the user has interacted with the configuration page.
    // For that reason, in case of no configuration, we assume that the internal Alertmanager is interested in alerts.
    return true;
  }
  switch (config.alertmanagersChoice) {
    case AlertmanagerChoice.Internal:
    case AlertmanagerChoice.All:
      return true;
    case AlertmanagerChoice.External:
    default:
      return false;
  }
};
