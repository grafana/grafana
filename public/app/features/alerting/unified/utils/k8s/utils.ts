import { type ObjectMeta, type ReceiverIntegration } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { K8sAnnotations } from 'app/features/alerting/unified/utils/k8s/constants';
import { type GrafanaManagedReceiverConfig } from 'app/plugins/datasource/alertmanager/types';

import { KnownProvenance } from '../../types/knownProvenance';

/**
 * Should we call the kubernetes-style API for managing alertmanager entities?
 *
 * Requires the alertmanager referenced being the Grafana AM,
 * and the `alertingApiServer` feature toggle being enabled
 */
export const shouldUseK8sApi = (alertmanager?: string) => {
  return alertmanager === GRAFANA_RULES_SOURCE_NAME;
};

type EntityToCheck = {
  metadata?: ObjectMeta;
};

/**
 * Check the metadata of a kubernetes entity and check if has the necessary annotations
 * that denote it as provisioned
 */
export const isK8sEntityProvisioned = (k8sEntity: EntityToCheck) => {
  const provenance = getAnnotation(k8sEntity, K8sAnnotations.Provenance);
  return isProvisionedResource(provenance);
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

export const canModifyProtectedEntity = (k8sEntity: EntityToCheck) =>
  getAnnotation(k8sEntity, K8sAnnotations.AccessModifyProtected) === 'true';

export const canTestEntity = (k8sEntity: EntityToCheck) =>
  getAnnotation(k8sEntity, K8sAnnotations.AccessTest) === 'true';

/**
 * Escape \ and = characters for field selectors.
 * The Kubernetes API Machinery will decode those automatically.
 */
export const encodeFieldSelector = (value: string): string => {
  return value.replaceAll(/\\/g, '\\\\').replaceAll(/\=/g, '\\=').replaceAll(/,/g, '\\,');
};

type FieldSelector = [string, string] | [string, string, '=' | '!='];
export const stringifyFieldSelector = (fieldSelectors: FieldSelector[]): string => {
  return fieldSelectors
    .map(([key, value, operator = '=']) => `${key}${operator}${encodeFieldSelector(value)}`)
    .join(',');
};

export function isProvisionedResource(provenance?: string): boolean {
  return Boolean(provenance && provenance !== KnownProvenance.None);
}

export function isImportedResource(provenance?: string): boolean {
  return provenance === KnownProvenance.ConvertedPrometheus;
}

// Maximum allowed length for an RBAC-managed entity name, matching the backend's UIDMaxLength.
const MAX_NAME_LENGTH = 40;

// DNS1123 subdomain: lowercase alphanumeric, hyphens and dots; must start and end with alphanumeric.
// Equivalent to the Kubernetes k8s.io/apimachinery IsDNS1123Subdomain check used by the backend.
const DNS1123_SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

/**
 * Validates the name of an RBAC-managed entity (e.g. a routing tree), mirroring the backend rules:
 *  1. Non-empty after trimming whitespace
 *  2. No colon character (confuses RBAC)
 *  3. At most 40 characters
 *  4. Must be a valid DNS1123 subdomain (lowercase, alphanumeric, hyphens, dots; no underscores or uppercase)
 *  5. Optionally, not already present in existingNames
 *
 * Returns an Error when invalid, or undefined when valid.
 */
export function validateRbacEntityName(name?: string): Error | undefined {
  const trimmed = (name ?? '').trim();

  if (trimmed.length === 0) {
    return new Error('Name is required');
  }

  if (trimmed.includes(':')) {
    return new Error("Name cannot contain ':'");
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return new Error(`Name cannot be longer than ${MAX_NAME_LENGTH} characters`);
  }

  if (!DNS1123_SUBDOMAIN_REGEX.test(trimmed)) {
    return new Error(
      'Name must be a valid DNS subdomain: lowercase alphanumeric characters, hyphens and dots only, and must start and end with an alphanumeric character'
    );
  }

  return undefined;
}

export function receiverConfigToK8sIntegration(config: GrafanaManagedReceiverConfig): ReceiverIntegration {
  return {
    uid: config.uid,
    disableResolveMessage: config.disableResolveMessage,
    secureFields: config.secureFields,
    settings: config.settings,
    type: config.type,
    version: config.version ?? 'v1',
  };
}
