import { type IconName } from '@grafana/ui';
import { type Repository, type SyncStatus } from 'app/api/clients/provisioning/v0alpha1';

/**
 * Annotation that tells the backend to complete a repository deletion even when
 * the repository cannot be built from its configuration (e.g. its credentials
 * have expired). Provider-side cleanup that needs a working client — notably
 * webhook removal — is then skipped, leaving those remote resources in place
 * rather than blocking deletion forever. Mirrors the backend constant in
 * apps/provisioning/pkg/repository/finalizers.go.
 */
export const FORCE_DELETE_REPOSITORY_ANNOTATION = 'provisioning.grafana.app/force-delete';

/**
 * Generic type for Kubernetes resources with generation tracking
 */
type ReconciledResource = {
  metadata?: { generation?: number };
  status?: { observedGeneration?: number };
};

/**
 * Checks if a Kubernetes resource has been fully reconciled by the backend.
 * A resource is reconciled when status.observedGeneration >= metadata.generation,
 * meaning the controller has processed the latest spec changes.
 */
export function isResourceReconciled(resource?: ReconciledResource): boolean {
  const generation = resource?.metadata?.generation;
  const observedGeneration = resource?.status?.observedGeneration;
  return generation !== undefined && observedGeneration !== undefined && observedGeneration >= generation;
}

/**
 * Reports whether a repository is currently unhealthy. An unhealthy repository
 * (for example, one whose credentials have expired) cannot be cleanly deleted
 * because provider-side resources such as webhooks can no longer be removed, so
 * deletion needs the force-delete escape hatch.
 */
export function isRepositoryUnhealthy(repository?: Repository): boolean {
  return repository?.status?.health?.healthy === false;
}

export const getStatusColor = (state?: SyncStatus['state']) => {
  switch (state) {
    case 'success':
      return 'green';
    case 'working':
      return 'blue';
    case 'warning':
      return 'orange';
    case 'pending':
      return 'darkgrey';
    case 'error':
      return 'red';
    default:
      return 'darkgrey';
  }
};

export const getStatusIcon = (state?: SyncStatus['state']): IconName => {
  switch (state) {
    case 'success':
      return 'check';
    case 'warning':
      return 'exclamation-triangle';
    case 'working':
    case 'pending':
      return 'spinner';
    case 'error':
      return 'exclamation-triangle';
    default:
      return 'exclamation-triangle';
  }
};
