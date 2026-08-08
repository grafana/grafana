import { t } from '@grafana/i18n';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { type NotebookElement, type PanelKind } from '@grafana/schema/apis/notebook/v2beta1';
import { appEvents } from 'app/core/app_events';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { vizPanelToSchemaV2 } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2';
import { ShowModalReactEvent } from 'app/types/events';

import { AddToNotebookModal } from './AddToNotebookModal';
import { quickAddToLastNotebook } from './quickAddToLastNotebook';

function capturePanel(panel: VizPanel, dashboard: DashboardScene): NotebookElement {
  // The dashboard and notebook Panel/LibraryPanel kinds are generated identically
  // from the same OpenAPI source; bridge them at this seam.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- identical leaf type across the two schemas
  const element = vizPanelToSchemaV2(panel) as unknown as NotebookElement;
  if (element.kind === 'Panel') {
    interpolateVariables(element, panel);
    annotateOrigin(element, dashboard);
  }
  return element;
}

/**
 * Dashboard panels usually reference template variables ($instance, $job, ...) that
 * don't exist in a notebook. Resolve them to their current values at capture time —
 * in queries, the title and panel options (e.g. text panel content) — so the
 * notebook panel keeps showing what the user was looking at.
 */
function interpolateVariables(element: PanelKind, panel: VizPanel) {
  element.spec.title = sceneGraph.interpolate(panel, element.spec.title);
  element.spec.data.spec.queries = element.spec.data.spec.queries.map((query) => ({
    ...query,
    spec: {
      ...query.spec,
      query: {
        ...query.spec.query,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- deep-walk preserves the query spec shape
        spec: interpolateDeep(query.spec.query.spec, panel) as Record<string, unknown>,
      },
    },
  }));
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- deep-walk preserves the options shape
  element.spec.vizConfig.spec.options = interpolateDeep(element.spec.vizConfig.spec.options, panel) as Record<
    string,
    unknown
  >;
}

// Query-time macros ($__rate_interval, $__timeFilter, ${__field.*}) are not dashboard
// variables: scene interpolation leaves them unresolved, so they stay dynamic.
function interpolateDeep(value: unknown, panel: VizPanel): unknown {
  if (typeof value === 'string') {
    return value.includes('$') ? sceneGraph.interpolate(panel, value) : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => interpolateDeep(item, panel));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolateDeep(item, panel)]));
  }
  return value;
}

/**
 * Dashboard panel menu → "Add to notebook": captures the panel's full definition
 * (queries, datasource, viz options, field config) as a notebook panel element and
 * opens the shared add-to-notebook flow. Loaded lazily from the menu behavior to
 * keep notebooks code out of the dashboard bundle path.
 */
export function addPanelToNotebookFromMenu(panel: VizPanel, dashboard: DashboardScene) {
  const element = capturePanel(panel, dashboard);
  const timeRange = sceneGraph.getTimeRange(panel).state.value.raw;

  appEvents.publish(
    new ShowModalReactEvent({
      component: AddToNotebookModal,
      props: {
        element,
        timeRange,
        sourceName: dashboard.state.title || t('notebooks.add-from-panel.unnamed-dashboard', 'this dashboard'),
      },
    })
  );
}

/**
 * Dashboard panel menu → "Add to <last notebook>": appends straight to the most
 * recently used notebook; falls back to the picker modal when that is not possible.
 */
export async function quickAddPanelToLastNotebookFromMenu(panel: VizPanel, dashboard: DashboardScene) {
  const element = capturePanel(panel, dashboard);
  const timeRange = sceneGraph.getTimeRange(panel).state.value.raw;

  const added = await quickAddToLastNotebook(element, { timeRange });
  if (!added) {
    addPanelToNotebookFromMenu(panel, dashboard);
  }
}

function annotateOrigin(element: PanelKind, dashboard: DashboardScene) {
  if (!element.spec.subtitle && dashboard.state.title) {
    element.spec.subtitle = t('notebooks.add-from-panel.origin', 'From dashboard: {{title}}', {
      title: dashboard.state.title,
    });
  }
}
