import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';

import { type Props } from './AddToNotebookForm';

const AddToNotebookFormLazy = lazy(() => import(/* webpackChunkName: "AddToNotebookForm" */ './AddToNotebookForm'));

/**
 * EXPOSED COMPONENT (stable): grafana/add-to-notebook-form/v1
 *
 * This component is exposed to plugins via the Plugin Extensions system.
 * Treat its props and user-visible behavior as a stable contract. Do not make
 * breaking changes in-place. If you need to change the API or behavior in a
 * breaking way, create a new versioned component (e.g. AddToNotebookFormV2)
 * and register it under a new ID: "grafana/add-to-notebook-form/v2".
 *
 * Consumers should import it using the exposed component ID and pass only the
 * supported props. The host owns the modal; this is the form inside it, same as
 * grafana/add-to-dashboard-form/v1. The default buildPanel creates a time series
 * panel; callers can supply a custom builder via "buildPanel".
 *
 * Render it only when the `dashboard.notebooks` feature flag is on.
 *
 * Usage from a plugin:
 * ```tsx
 * import { PluginExtensionExposedComponents } from '@grafana/data';
 * import { usePluginComponent } from '@grafana/runtime';
 *
 * const { component: AddToNotebookForm } = usePluginComponent(
 *   PluginExtensionExposedComponents.AddToNotebookFormV1
 * );
 *
 * <Modal title="Add panel to notebook" isOpen onDismiss={onClose}>
 *   <AddToNotebookForm
 *     onClose={onClose}
 *     buildPanel={() => ({
 *       type: 'timeseries',
 *       title: 'Error rate',
 *       datasource: { type: 'prometheus', uid: 'prometheus' },
 *       targets: [{ refId: 'A', expr: 'rate(errors_total[5m])' }],
 *     })}
 *   />
 * </Modal>
 * ```
 */
export const AddToNotebookFormExposedComponent = (props: Partial<Props>) => (
  <Suspense fallback={null}>
    <AddToNotebookFormLazy
      onClose={props.onClose ?? (() => {})}
      buildPanel={
        props.buildPanel ??
        (() => ({
          type: 'timeseries',
          title: t('notebooks.add-to-notebook-form.title.new-panel', 'New panel'),
          targets: [],
        }))
      }
    />
  </Suspense>
);
