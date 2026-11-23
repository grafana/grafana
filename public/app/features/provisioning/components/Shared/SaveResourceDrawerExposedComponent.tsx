import { Suspense, lazy } from 'react';

import { type SaveResourceDrawerV1AlphaProps } from '@grafana/data';

const SaveProvisionedResourceDrawer = lazy(() =>
  import('./SaveProvisionedResourceDrawer').then((module) => ({ default: module.SaveProvisionedResourceDrawer }))
);

export function SaveResourceDrawerExposedComponent({
  resource,
  title,
  action,
  ...rest
}: Partial<SaveResourceDrawerV1AlphaProps>) {
  if (!resource || !title || !action) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <SaveProvisionedResourceDrawer {...rest} resource={resource} title={title} action={action} />
    </Suspense>
  );
}
