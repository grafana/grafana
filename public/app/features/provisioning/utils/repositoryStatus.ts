import { BadgeColor, IconName } from '@grafana/ui';
import { SyncStatus } from 'app/api/clients/provisioning/v0alpha1';

export interface RepositoryStatus {
  color: BadgeColor;
  text: string;
  icon: IconName;
  tooltip?: string;
}

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
