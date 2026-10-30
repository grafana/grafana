import { lazy, Suspense } from 'react';

import { type PanelDataErrorViewProps } from '@grafana/runtime';

const PanelDataErrorView = lazy(() =>
  import(/* webpackChunkName: "panel-data-error-view" */ './PanelDataErrorView').then((module) => ({
    default: module.PanelDataErrorView,
  }))
);

export function LazyPanelDataErrorView(props: PanelDataErrorViewProps) {
  return (
    <Suspense fallback={null}>
      <PanelDataErrorView {...props} />
    </Suspense>
  );
}
