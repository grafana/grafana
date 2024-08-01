import { config } from '@grafana/runtime';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

/**
 * Get the correct namespace to use when using the K8S API.
 */
export const getNamespace = () => config.namespace;

/**
 * Should we call the kubernetes-style API for managing alertmanager entities?
 *
 * Requires the alertmanager referenced being the Grafana AM,
 * and the `alertingApiServer` feature toggle being enabled
 */
export const shouldUseK8sApi = (alertmanager?: string) => {
  const featureToggleEnabled = config.featureToggles.alertingApiServer;
  return featureToggleEnabled && alertmanager === GRAFANA_RULES_SOURCE_NAME;
};
