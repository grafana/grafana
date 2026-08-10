import { config } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { type PanelKind as DashboardPanelKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type PanelKind } from '@grafana/schema/apis/notebook/v2beta1';
import { createPanelDataProvider } from 'app/features/dashboard-scene/serialization/layoutSerializers/utils';
import { transformMappingsToV1 } from 'app/features/dashboard-scene/serialization/transformToV1TypesUtils';
import { getVizPanelKeyForPanelId } from 'app/features/dashboard-scene/utils/utils';

/**
 * Builds a standalone VizPanel from a notebook panel element. Unlike the dashboard
 * serializer's buildVizPanel, this deliberately skips the parts that require a
 * DashboardScene ancestor (panel menu, header actions, dashboard panel context) so
 * the panel can live inside the notebook editor's own embedded scene.
 */
export function buildNotebookVizPanel(panel: PanelKind): VizPanel {
  // The notebook and dashboard PanelKind types are generated identically from the same
  // OpenAPI source but live in sibling modules; bridge them here (same convention as
  // the notebook layout serializer).
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- identical leaf type across the two schemas
  const dashPanel = panel as unknown as DashboardPanelKind;
  const spec = dashPanel.spec;

  return new VizPanel({
    key: getVizPanelKeyForPanelId(spec.id),
    title: spec.title?.substring(0, 5000),
    description: spec.description || undefined,
    pluginId: spec.vizConfig.group,
    options: spec.vizConfig.spec.options ?? {},
    fieldConfig: transformMappingsToV1(spec.vizConfig.spec.fieldConfig),
    pluginVersion: spec.vizConfig.version || undefined,
    displayMode: spec.transparent ? 'transparent' : 'default',
    seriesLimit: config.panelSeriesLimit,
    $data: createPanelDataProvider(dashPanel),
  });
}
