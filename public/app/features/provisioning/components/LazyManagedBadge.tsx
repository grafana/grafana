import { Suspense, lazy } from 'react';

import { type ManagedBadgeV1Props } from '@grafana/data';

import { getManagerIdentity, getManagerKind, getSourcePath, isManaged } from '../utils/managedResource';

const SuspendingManagedBadge = lazy(() =>
  import('./ManagedBadge').then((module) => ({ default: module.ManagedBadge }))
);

export const LazyManagedBadge = ({ resource }: Partial<ManagedBadgeV1Props>) => {
  if (!resource || !isManaged(resource)) {
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
