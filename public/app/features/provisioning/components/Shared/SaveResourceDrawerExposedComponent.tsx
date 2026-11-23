import { Suspense, lazy } from 'react';

import { type SaveResourceDrawerV1AlphaProps } from '@grafana/data';

import { type SaveProvisionedResourceDrawerProps } from './SaveProvisionedResourceDrawer';

const SaveProvisionedResourceDrawer = lazy(() =>
  import('./SaveProvisionedResourceDrawer').then((module) => ({ default: module.SaveProvisionedResourceDrawer }))
);

function LazySaveProvisionedResourceDrawer(props: SaveProvisionedResourceDrawerProps) {
  return (
    <Suspense fallback={null}>
      <SaveProvisionedResourceDrawer {...props} />
    </Suspense>
  );
}

export function SaveResourceDrawerExposedComponent({
  resource,
  title,
  action,
  repositoryName,
  ...rest
}: Partial<SaveResourceDrawerV1AlphaProps>) {
  if (!resource || !title || !action) {
    return null;
  }
  if (action === 'create') {
    return (
      <LazySaveProvisionedResourceDrawer
        {...rest}
        resource={resource}
        title={title}
        action={action}
        repositoryName={repositoryName}
      />
    );
  }
  return <LazySaveProvisionedResourceDrawer {...rest} resource={resource} title={title} action={action} />;
}
