import { Suspense, lazy } from 'react';

import { DataSourcePickerSkeleton } from './Skeleton';

const SuspendingDataSourcePicker = lazy(() =>
  import('./DataSourcePicker').then((module) => ({ default: module.DataSourcePicker }))
);

// Lazily load folder picker, is what is exposed to plugins through @grafana/runtime
export const LazyDataSourcePicker = (props: Parameters<typeof SuspendingDataSourcePicker>[0]) => {
  return (
    <Suspense fallback={<DataSourcePickerSkeleton />}>
      <SuspendingDataSourcePicker {...props} />
    </Suspense>
  );
};
