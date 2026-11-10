import { type SaveResourceDrawerV1Props } from '@grafana/data';

import { LazySaveProvisionedResourceDrawer } from './LazySaveProvisionedResourceDrawer';
import { type SaveProvisionedResourceDrawerProps } from './SaveProvisionedResourceDrawer';

export function SaveResourceDrawerExposedComponent(props: Partial<SaveResourceDrawerV1Props>) {
  if (!props.resource || !props.title || !props.action) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return <LazySaveProvisionedResourceDrawer {...(props as SaveProvisionedResourceDrawerProps)} />;
}
