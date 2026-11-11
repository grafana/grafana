import { Suspense, lazy } from 'react';

import PageLoader from 'app/core/components/PageLoader/PageLoader';

import { type DashboardViewProps } from './DashboardView';

/**
 * The registered form of `grafana/dashboard-view/v1`, split out so the dashboard scene
 * isn't pulled into the entry chunk through the exposed-components registry.
 */
const DashboardView = lazy(() =>
  import(/* webpackChunkName: "DashboardView" */ './DashboardView').then((module) => ({
    default: module.DashboardView,
  }))
);

/** Props are widened because the registry types every exposed component as `ComponentType<{}>`. */
export function DashboardViewLazy(props: Partial<DashboardViewProps>) {
  if (!props.uid) {
    return null;
  }
  return (
    <Suspense fallback={<PageLoader />}>
      <DashboardView {...props} uid={props.uid} />
    </Suspense>
  );
}
