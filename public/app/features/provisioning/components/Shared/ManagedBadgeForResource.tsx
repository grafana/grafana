import { type provisioning } from '@grafana/runtime';

import { getManagerIdentity, getManagerKind, getSourcePath, isManaged } from '../../utils/managedResource';
import { ManagedBadge } from '../ManagedBadge';

/**
 * `provisioning.ManagedBadge` in `@grafana/runtime`. Renders nothing for an unmanaged resource, so
 * callers can render it for every resource.
 */
export function ManagedBadgeForResource({ resource }: provisioning.ManagedBadgeProps) {
  if (!isManaged(resource)) {
    return null;
  }
  return (
    <ManagedBadge
      managerKind={getManagerKind(resource)}
      name={getManagerIdentity(resource)}
      repositoryName={getManagerIdentity(resource)}
      sourcePath={getSourcePath(resource)}
    />
  );
}
