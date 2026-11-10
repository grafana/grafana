import { Suspense, lazy } from 'react';

import { type InterceptedWriteDrawerProps } from './InterceptedWriteDrawer';

const SuspendingInterceptedWriteDrawer = lazy(() =>
  import('./InterceptedWriteDrawer').then((module) => ({ default: module.InterceptedWriteDrawer }))
);

export const LazyInterceptedWriteDrawer = (props: InterceptedWriteDrawerProps) => {
  return (
    <Suspense fallback={null}>
      <SuspendingInterceptedWriteDrawer {...props} />
    </Suspense>
  );
};
