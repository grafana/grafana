import { config } from '@grafana/runtime';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { PROVENANCE_ANNOTATION, PROVENANCE_NONE } from 'app/features/alerting/unified/utils/k8s/constants';

/**
 * Get the correct namespace to use when using the K8S API.
 */
export const getK8sNamespace = () => config.namespace;

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

type Entity = {
  metadata: {
    annotations?: Record<string, string>;
  };
};

/**
 * Check the metadata of a kubernetes entity and check if has the necessary annotations
 * that denote it as provisioned
 */
export const isK8sEntityProvisioned = (item: Entity) =>
  item.metadata.annotations?.[PROVENANCE_ANNOTATION] !== PROVENANCE_NONE;
