import { lazy, Suspense } from 'react';

import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';

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
 * grafana/add-to-dashboard-form/v1. Callers pass "buildPanel" for the panel to
 * store and "capturedTimeRange" for the window it was showing. The form offers
 * to lock the panel to that window.
 *
 * Requires the `dashboard.notebooks` feature flag.
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
 *     capturedTimeRange={{ from: '2026-10-05T08:00:00.000Z', to: '2026-10-05T09:30:00.000Z' }}
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
export const AddToNotebookFormExposedComponent = (props: Partial<Props>) => {
  const enabled = useFlagDashboardNotebooks();
  if (!enabled) {
    console.error(`[AddToNotebookFormExposedComponent] The required feature flag dashboard.notebooks is not enabled.`);
    return null;
  }

  if (!props.onClose || !props.buildPanel || !props.capturedTimeRange) {
    console.error(
      `[AddToNotebookFormExposedComponent] Missing required props: onClose, buildPanel, capturedTimeRange.`
    );
    return null;
  }

  return (
    <Suspense fallback={null}>
      <AddToNotebookFormLazy
        onClose={props.onClose}
        buildPanel={props.buildPanel}
        capturedTimeRange={props.capturedTimeRange}
      />
    </Suspense>
  );
};
