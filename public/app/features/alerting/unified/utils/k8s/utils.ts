import { config } from '@grafana/runtime';
import { IoK8SApimachineryPkgApisMetaV1ObjectMeta } from 'app/features/alerting/unified/openapi/receiversApi.gen';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { K8sAnnotations, PROVENANCE_NONE } from 'app/features/alerting/unified/utils/k8s/constants';

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

type EntityToCheck = {
  metadata?: IoK8SApimachineryPkgApisMetaV1ObjectMeta;
};

/**
 * Check the metadata of a kubernetes entity and check if has the necessary annotations
 * that denote it as provisioned
 */
export const isK8sEntityProvisioned = (k8sEntity: EntityToCheck) => {
  const provenance = getAnnotation(k8sEntity, K8sAnnotations.Provenance);
  return Boolean(provenance && provenance !== PROVENANCE_NONE);
};

export const ANNOTATION_PREFIX_ACCESS = 'grafana.com/access/';

/**
 * Checks annotations on a k8s entity to see if the requesting user has the required permission
 */
export const getAnnotation = (k8sEntity: EntityToCheck, annotation: K8sAnnotations) =>
  k8sEntity.metadata?.annotations?.[annotation];

export const canEditEntity = (k8sEntity: EntityToCheck) =>
  getAnnotation(k8sEntity, K8sAnnotations.AccessWrite) === 'true';

export const canAdminEntity = (k8sEntity: EntityToCheck) =>
  getAnnotation(k8sEntity, K8sAnnotations.AccessAdmin) === 'true';

export const canDeleteEntity = (k8sEntity: EntityToCheck) =>
  getAnnotation(k8sEntity, K8sAnnotations.AccessDelete) === 'true';

/**
 * Escape \ and = characters for field selectors.
 * The Kubernetes API Machinery will decode those automatically.
 */
export const encodeFieldSelector = (value: string): string => {
  return value.replaceAll(/\\/g, '\\\\').replaceAll(/\=/g, '\\=').replaceAll(/,/g, '\\,');
};
