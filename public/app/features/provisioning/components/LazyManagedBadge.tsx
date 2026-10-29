import { Suspense, lazy } from 'react';

import { type ManagedBadgeProps } from '@grafana/runtime';

import { getManagerIdentity, getManagerKind, getSourcePath, isManaged } from '../utils/managedResource';

const SuspendingManagedBadge = lazy(() =>
  import('./ManagedBadge').then((module) => ({ default: module.ManagedBadge }))
);

export const LazyManagedBadge = ({ resource }: ManagedBadgeProps) => {
  if (!isManaged(resource)) {
    return null;
  }
  const repositoryName = getManagerIdentity(resource);
  return (
    <Suspense fallback={null}>
      <SuspendingManagedBadge
        managerKind={getManagerKind(resource)}
        name={repositoryName}
        repositoryName={repositoryName}
        sourcePath={getSourcePath(resource)}
      />
    </Suspense>
  );
};
