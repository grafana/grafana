import { type ExplorePanelsState } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { type DataQuery, type DataSourceRef } from '@grafana/schema';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { vizPanelToSchemaV2 } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2';
import { createPanelDataProvider } from 'app/features/dashboard-scene/utils/createPanelDataProvider';
import { getVizPanelKeyForPanelId } from 'app/features/dashboard-scene/utils/utils-panels';
import { buildDashboardPanelFromExploreState } from 'app/features/explore/extensions/AddToDashboard/addToDashboard';
import { type ExplorePanelData } from 'app/types/explore';

import { type PanelElement } from '../types';

/**
 * The id only has to be free within this throwaway panel — appendPanelToNotebook mints the one the
 * notebook actually stores.
 */
const TRANSIENT_PANEL_ID = 1;

interface ExplorePaneSnapshot {
  queries: DataQuery[];
  queryResponse: ExplorePanelData;
  datasource?: DataSourceRef;
  panelState?: ExplorePanelsState;
}

/**
 * Turns the state of an Explore pane into the panel element a notebook stores.
 *
 * Routed through Explore's own buildDashboardPanelFromExploreState rather than assembling a VizPanel
 * from the pane directly: that function owns the visualization-type inference and the logs-table
 * transformations, and neither helper it uses is exported, so building the panel here would mean a
 * second copy of both that drifts the first time Explore learns a new frame type.
 *
 * The VizPanel is assembled by hand rather than via buildGridItemForPanel because that builds panel
 * menus, header actions and link behaviors that only make sense inside a live dashboard — none of
 * which vizPanelToSchemaV2 reads.
 */
export function buildPanelElementFromExplore(pane: ExplorePaneSnapshot): PanelElement {
  const panel = new PanelModel({
    ...buildDashboardPanelFromExploreState(pane),
    id: TRANSIENT_PANEL_ID,
  });

  const vizPanel = new VizPanel({
    key: getVizPanelKeyForPanelId(panel.id),
    title: panel.title,
    pluginId: panel.type,
    options: panel.options ?? {},
    fieldConfig: panel.fieldConfig,
    $data: createPanelDataProvider(panel),
  });

  // Both optional args stay omitted: a dsReferencesMapping would send vizPanelToSchemaV2 looking for
  // an enclosing DashboardScene, and this panel has no scene at all.
  return vizPanelToSchemaV2(vizPanel);
}
