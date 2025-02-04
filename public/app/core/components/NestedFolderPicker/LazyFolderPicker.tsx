import { Suspense, lazy } from 'react';

import { FolderPickerSkeleton } from './Skeleton';

const SuspendingNestedFolderPicker = lazy(() =>
  import('./NestedFolderPicker').then((module) => ({ default: module.NestedFolderPicker }))
);

export const LazyFolderPicker = (props: Parameters<typeof SuspendingNestedFolderPicker>[0]) => {
  return (
    <Suspense fallback={<FolderPickerSkeleton />}>
      <SuspendingNestedFolderPicker {...props} />
    </Suspense>
  );
};
