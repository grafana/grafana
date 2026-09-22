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

// Ready-condition reasons that mean the provider is genuinely unreachable, so
// provider-side cleanup (deleting the webhook) can't run. Deliberately narrower
// than health.healthy === false: a repository can be unhealthy yet still
// reachable (e.g. over quota, or branch protection blocking writes, both of
// which the backend runs deletion hooks for), and force-deleting those would
// orphan the webhook needlessly. 401/bare-403 map to AuthenticationFailed and
// 503 to ServiceUnavailable in the backend's Ready-reason classification.
const INACCESSIBLE_READY_REASONS = ['AuthenticationFailed', 'ServiceUnavailable'];

/**
 * Reports whether a repository is unreachable such that provider-side cleanup
 * (webhook deletion) can no longer run. When true, deletion needs the
 * force-delete escape hatch of dropping the cleanup finalizer, and the remote
 * webhook is left behind because it can't be removed without a working
 * connection. Gated on the Ready condition's reason rather than the raw health
 * boolean so that reachable-but-unhealthy repositories still clean up normally.
 */
export function isRepositoryInaccessible(repository?: Repository): boolean {
  const ready = repository?.status?.conditions?.find((condition) => condition.type === 'Ready');
  if (ready?.status !== 'False') {
    return false;
  }
  return INACCESSIBLE_READY_REASONS.includes(ready.reason);
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
