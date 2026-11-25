import { Suspense, lazy } from 'react';

import { type ManagedBadgeV1AlphaProps } from '@grafana/data';

import { getManagerIdentity, getManagerKind, getSourcePath, isManaged } from '../utils/managedResource';

const ManagedResourceBadge = lazy(() =>
  import('./ManagedResourceBadge').then((module) => ({ default: module.ManagedResourceBadge }))
);

export function ManagedBadgeExposedComponent({ resource }: Partial<ManagedBadgeV1AlphaProps>) {
  if (!resource || !isManaged(resource)) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <ManagedResourceBadge
        managerKind={getManagerKind(resource)}
        name={getManagerIdentity(resource)}
        repositoryName={getManagerIdentity(resource)}
        sourcePath={getSourcePath(resource)}
      />
    </Suspense>
  );
}
