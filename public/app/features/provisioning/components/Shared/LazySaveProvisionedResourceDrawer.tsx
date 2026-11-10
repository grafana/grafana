import { Suspense, lazy } from 'react';

import { type SaveProvisionedResourceDrawerProps } from './SaveProvisionedResourceDrawer';

const SuspendingSaveProvisionedResourceDrawer = lazy(() =>
  import('./SaveProvisionedResourceDrawer').then((module) => ({ default: module.SaveProvisionedResourceDrawer }))
);

export const LazySaveProvisionedResourceDrawer = (props: SaveProvisionedResourceDrawerProps) => {
  return (
    <Suspense fallback={null}>
      <SuspendingSaveProvisionedResourceDrawer {...props} />
    </Suspense>
  );
};
