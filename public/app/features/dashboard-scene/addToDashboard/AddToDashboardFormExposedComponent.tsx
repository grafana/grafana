import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';

import { AbsolutePathOptions, Props } from './AddToDashboardForm';

// Lazy load the component
const AddToDashboardFormLazy = lazy(() => import('./AddToDashboardForm'));

/**
 * EXPOSED COMPONENT (stable): grafana/add-to-dashboard-form/v1
 *
 * This component is exposed to plugins via the Plugin Extensions system.
 * Treat its props and user-visible behavior as a stable contract. Do not make
 * breaking changes in-place. If you need to change the API or behavior in a
 * breaking way, create a new versioned component (e.g. AddToDashboardFormV2)
 * and register it under a new ID: "grafana/add-to-dashboard-form/v2".
 *
 * Consumers should import it using the exposed component ID and pass only the
 * supported props. The default buildPanel creates a time series panel; callers
 * can supply a custom builder via "buildPanel".
 */
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
