import { Suspense, lazy } from 'react';

import { type CreateAlertFromPanelProps } from './CreateAlertFromPanelExposedComponent';

const CreateAlertFromPanelExposedComponent = lazy(() =>
  import(/* webpackChunkName: "DashboardAlertingCreate" */ './CreateAlertFromPanelExposedComponent').then(
    (module) => ({
      default: module.CreateAlertFromPanelExposedComponent,
    })
  )
);

export function CreateAlertFromPanelExposedComponentLazy(props: Partial<CreateAlertFromPanelProps>) {
  return (
    <Suspense fallback={null}>
      <CreateAlertFromPanelExposedComponent {...props} />
    </Suspense>
  );
}
