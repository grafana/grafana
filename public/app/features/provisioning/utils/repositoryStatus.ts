import { type IconName } from '@grafana/ui';
import { type Repository, type SyncStatus } from 'app/api/clients/provisioning/v0alpha1';

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
 * Reports whether a repository's credentials have permanently failed (expired
 * or revoked), which the backend surfaces as the Ready condition reason
 * AuthenticationFailed. This is the only state where provider-side cleanup
 * (deleting the webhook) can never run: without valid credentials the webhook
 * can't be removed, and unlike a transient outage it won't self-heal, so
 * deletion would wedge forever on the cleanup finalizer.
 *
 * Deliberately narrow. A repository can be unhealthy for reasons the backend
 * still cleans up webhooks for — an invalid spec (e.g. a wrong branch), over
 * quota, or branch protection — and the delete path never calls Test(), so
 * those delete normally; force-deleting them would orphan the webhook
 * needlessly. Transient failures (ServiceUnavailable, RateLimited) are excluded
 * too: retrying once infra recovers is better than orphaning the webhook.
 */
export function hasRepositoryCredentialFailure(repository?: Repository): boolean {
  const ready = repository?.status?.conditions?.find((condition) => condition.type === 'Ready');
  return ready?.status === 'False' && ready.reason === 'AuthenticationFailed';
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
