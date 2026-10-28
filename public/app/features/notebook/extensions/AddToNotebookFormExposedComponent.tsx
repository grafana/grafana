import { lazy, Suspense } from 'react';

import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';

import { canAddPanelToNotebook } from '../permissions';

import { type LooseProps, type Props } from './AddToNotebookForm';

const AddToNotebookFormLazy = lazy(() => import(/* webpackChunkName: "AddToNotebookForm" */ './AddToNotebookForm'));

/**
 * EXPOSED COMPONENT (stable): grafana/add-to-notebook-form/v1 and grafana/add-to-notebook-form/v2
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
 * v2 is the same component and adds ordered content: pass "cells" (markdown and panels,
 * each panel with its own captured window) instead of "buildPanel". Optional: "defaultTitle"
 * prefills a new notebook's title, "onAdded" receives { uid, title, url } after the write,
 * and "source" attributes the cells ("user" by default, "assistant" for generated content).
 * Use v2 for any of these: Grafana builds with only v1 ignore them, and v2's presence is how
 * a plugin knows they are supported.
 *
 * Requires the `dashboard.notebooks` feature flag and `notebooks:create` or `notebooks:write`.
 * It is only registered while `dashboard.notebooks` is on, so a missing component means notebooks are off.
 *
 * Usage from a plugin:
 * ```tsx
 * import { PluginExtensionExposedComponents } from '@grafana/data';
 * import { usePluginComponent } from '@grafana/runtime';
 *
 * const { component: AddToNotebookForm } = usePluginComponent(
 *   PluginExtensionExposedComponents.AddToNotebookFormV2
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
export const AddToNotebookFormExposedComponent = (props: LooseProps) => {
  const enabled = useFlagDashboardNotebooks();
  if (!enabled) {
    console.error(`[AddToNotebookFormExposedComponent] The required feature flag dashboard.notebooks is not enabled.`);
    return null;
  }

  // Explore and the panel menu use this same check. Without create or write, Add submits a
  // write the apiserver rejects.
  if (!canAddPanelToNotebook()) {
    console.error(
      `[AddToNotebookFormExposedComponent] The user needs notebooks:create or notebooks:write to add a panel to a notebook.`
    );
    return null;
  }

  const formProps = toFormProps(props);
  if (!formProps) {
    console.error(
      `[AddToNotebookFormExposedComponent] Pass onClose and exactly one of: buildPanel with capturedTimeRange, or cells.`
    );
    return null;
  }

  return (
    <Suspense fallback={null}>
      <AddToNotebookFormLazy {...formProps} />
    </Suspense>
  );
};

/** One shape or the other, or nothing when the plugin passed neither or both. */
function toFormProps({ onClose, buildPanel, capturedTimeRange, cells, ...rest }: LooseProps): Props | undefined {
  if (!onClose) {
    return undefined;
  }
  if (cells) {
    return buildPanel || capturedTimeRange ? undefined : { ...rest, onClose, cells };
  }
  return buildPanel && capturedTimeRange ? { ...rest, onClose, buildPanel, capturedTimeRange } : undefined;
}
