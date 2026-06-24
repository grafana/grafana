import { Suspense, lazy } from 'react';

import { FolderPickerSkeleton } from './Skeleton';

const SuspendingNestedFolderPicker = lazy(() =>
  import('./NestedFolderPicker').then((module) => ({ default: module.NestedFolderPicker }))
);

// Lazily load folder picker, is what is exposed to plugins through @grafana/runtime
export const LazyFolderPicker = (props: Parameters<typeof SuspendingNestedFolderPicker>[0]) => {
  return (
    <Suspense fallback={<FolderPickerSkeleton />}>
      <SuspendingNestedFolderPicker {...props} />
    </Suspense>
  );
};
