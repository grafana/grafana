import { AlertmanagerChoice, GrafanaAlertingConfiguration } from 'app/plugins/datasource/alertmanager/types';

// if we have either "internal" or "both" configured this means the internal Alertmanager is receiving Grafana-managed alerts
export const isInternalAlertmanagerInterestedInAlerts = (config?: GrafanaAlertingConfiguration): boolean => {
  const INTERNAL_RECEIVING = [AlertmanagerChoice.Internal, AlertmanagerChoice.All];
  return INTERNAL_RECEIVING.some((choice) => config?.alertmanagersChoice === choice);
};
