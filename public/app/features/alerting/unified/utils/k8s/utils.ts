import { config } from '@grafana/runtime';
import { IoK8SApimachineryPkgApisMetaV1ObjectMeta } from 'app/features/alerting/unified/openapi/receiversApi.gen';
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

type EntityToCheck = {
  metadata?: IoK8SApimachineryPkgApisMetaV1ObjectMeta;
};

/**
 * Different permissions that we expect to see in the k8s metadata annotations
 * under the `grafana.com/access/` key
 * */
type K8sPermission = 'canWrite' | 'canAdmin' | 'canDelete';

export const ANNOTATION_PREFIX_ACCESS = 'grafana.com/access/';

/**
 * Checks annotations on a k8s entity to see if the requesting user has the required permission
 */
const getContactPointPermission = (k8sEntity: EntityToCheck, permission: K8sPermission) =>
  k8sEntity.metadata?.annotations?.[ANNOTATION_PREFIX_ACCESS + permission] === 'true';

export const canEditEntity = (k8sEntity: EntityToCheck) => getContactPointPermission(k8sEntity, 'canWrite');

export const canAdminEntity = (k8sEntity: EntityToCheck) => getContactPointPermission(k8sEntity, 'canAdmin');

export const canDeleteEntity = (k8sEntity: EntityToCheck) => getContactPointPermission(k8sEntity, 'canDelete');

/** Annotation key that indicates how many notification policy routes are using this entity */
export const ANNOTATION_INUSE_ROUTES = 'grafana.com/inUse/routes';

/** Annotation key that indicates how many alert rules are using this entity */
export const ANNOTATION_INUSE_RULES = 'grafana.com/inUse/rules';
