import { Suspense, lazy } from 'react';

import { type RepositorySelectV1Props } from '@grafana/data';

const SuspendingRepositorySelectForKind = lazy(() =>
  import('./RepositorySelectForKind').then((module) => ({ default: module.RepositorySelectForKind }))
);

export const LazyRepositorySelect = ({ group, kind, onChange, ...props }: Partial<RepositorySelectV1Props>) => {
  if (!group || !kind || !onChange) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <SuspendingRepositorySelectForKind group={group} kind={kind} onChange={onChange} {...props} />
    </Suspense>
  );
};
