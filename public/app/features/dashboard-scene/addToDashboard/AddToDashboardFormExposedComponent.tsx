import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';

import { AbsolutePathOptions, Props } from './AddToDashboardForm';

// Lazy load the component
const AddToDashboardFormLazy = lazy(() => import('./AddToDashboardForm'));

// Wrap with Suspense and properly typed props
export const AddToDashboardFormExposedComponent = (props: Partial<Props<AbsolutePathOptions | undefined>>) => (
  <Suspense fallback={null}>
    <AddToDashboardFormLazy
      onClose={props.onClose ?? (() => {})}
      buildPanel={
        props.buildPanel ??
        (() => ({
          type: 'timeseries',
          title: t('dashboard-scene.add-to-dashboard-form-exposed.title.new-panel', 'New panel'),
          gridPos: { x: 0, y: 0, w: 12, h: 8 },
          targets: [],
        }))
      }
      timeRange={props.timeRange}
      options={props.options}
    >
      {props.children}
    </AddToDashboardFormLazy>
  </Suspense>
);
