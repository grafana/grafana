import { Suspense, lazy } from 'react';

import { type RepositorySelectProps } from '@grafana/runtime';

const SuspendingRepositorySelectForKind = lazy(() =>
  import('./RepositorySelectForKind').then((module) => ({ default: module.RepositorySelectForKind }))
);

export const LazyRepositorySelect = (props: RepositorySelectProps) => {
  return (
    <Suspense fallback={null}>
      <SuspendingRepositorySelectForKind {...props} />
    </Suspense>
  );
};
