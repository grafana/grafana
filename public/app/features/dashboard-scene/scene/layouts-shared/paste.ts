import { store } from '@grafana/data';
import {
  type AutoGridLayoutItemKind,
  type Spec as DashboardV2Spec,
  type GridLayoutItemKind,
  type RowsLayoutRowKind,
  type TabsLayoutTabKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { LS_PANEL_COPY_KEY, LS_ROW_COPY_KEY, LS_STYLES_COPY_KEY, LS_TAB_COPY_KEY } from 'app/core/constants';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';

import { deserializeAutoGridItem } from '../../serialization/layoutSerializers/AutoGridLayoutSerializer';
import { deserializeGridItem } from '../../serialization/layoutSerializers/DefaultGridLayoutSerializer';
import { deserializeRow } from '../../serialization/layoutSerializers/RowsLayoutSerializer';
import { deserializeTab } from '../../serialization/layoutSerializers/TabsLayoutSerializer';
import { buildGridItemForPanel } from '../../serialization/transformSaveModelToScene';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { type DashboardScene } from '../DashboardScene';
import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { type GridCell } from '../layout-default/findSpaceForNewPanel';
import { type RowItem } from '../layout-rows/RowItem';
import { type TabItem } from '../layout-tabs/TabItem';

export function clearClipboard() {
  store.delete(LS_PANEL_COPY_KEY);
  store.delete(LS_ROW_COPY_KEY);
  store.delete(LS_TAB_COPY_KEY);
  store.delete(LS_STYLES_COPY_KEY);
}

export interface RowStore {
  elements: DashboardV2Spec['elements'];
  row: RowsLayoutRowKind;
}

export interface TabStore {
  elements: DashboardV2Spec['elements'];
  tab: TabsLayoutTabKind;
}

export interface PanelStore {
  elements: DashboardV2Spec['elements'];
  gridItem: GridLayoutItemKind | AutoGridLayoutItemKind;
}

/** Dynamic Dashboards copy format: element map + layout item kind (dashboard schema v2). */
function isV2DynamicDashboardsPanelClipboard(obj: unknown): obj is PanelStore {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const elements = Reflect.get(obj, 'elements');
  if (elements === null || typeof elements !== 'object') {
    return false;
  }
  const gridItem = Reflect.get(obj, 'gridItem');
  if (gridItem === null || typeof gridItem !== 'object') {
    return false;
  }
  const kind = Reflect.get(gridItem, 'kind');
  return kind === 'GridLayoutItem' || kind === 'AutoGridLayoutItem';
}

export function getRowFromClipboard(scene: DashboardScene): RowItem {
  const jsonData = store.get(LS_ROW_COPY_KEY);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const jsonObj: RowStore = JSON.parse(jsonData) as RowStore;
  clearClipboard();
  const panelIdGenerator = dashboardSceneGraph.getPanelIdGenerator(scene);

  let row;
  // We don't control the local storage content, so if it's out of sync with the code all bets are off.
  try {
    row = deserializeRow(jsonObj.row, jsonObj.elements, false, panelIdGenerator);
  } catch (error) {
    throw new Error(`Error pasting row from clipboard. Please try to copy again.`, { cause: error });
  }
  return row;
}

export function getTabFromClipboard(scene: DashboardScene): TabItem {
  const jsonData = store.get(LS_TAB_COPY_KEY);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const jsonObj: TabStore = JSON.parse(jsonData) as TabStore;
  clearClipboard();
  const panelIdGenerator = dashboardSceneGraph.getPanelIdGenerator(scene);

  let tab;
  try {
    tab = deserializeTab(jsonObj.tab, jsonObj.elements, false, panelIdGenerator);
  } catch (error) {
    throw new Error(`Error pasting tab from clipboard. Please try to copy again.`, { cause: error });
  }
  return tab;
}

function getGridItemFromClipboard(scene: DashboardScene) {
  const jsonData = store.get(LS_PANEL_COPY_KEY);
  const parsed: unknown = JSON.parse(jsonData);

  let deserializedGridItem;
  try {
    if (isV2DynamicDashboardsPanelClipboard(parsed)) {
      const { elements, gridItem } = parsed;
      deserializedGridItem =
        gridItem.kind === 'GridLayoutItem'
          ? deserializeGridItem(gridItem, elements, dashboardSceneGraph.getPanelIdGenerator(scene))
          : deserializeAutoGridItem(gridItem, elements, dashboardSceneGraph.getPanelIdGenerator(scene));
    } else {
      const panelModel = new PanelModel(parsed);
      deserializedGridItem = buildGridItemForPanel(panelModel);
    }
  } catch (error) {
    throw new Error('Error pasting panel from clipboard, please try to copy again.', { cause: error });
  }
  return deserializedGridItem;
}

export function getAutoGridItemFromClipboard(scene: DashboardScene): AutoGridItem {
  const deserializedGridItem = getGridItemFromClipboard(scene);
  if (deserializedGridItem instanceof AutoGridItem) {
    return deserializedGridItem;
  }

  deserializedGridItem.state.body.clearParent();

  return new AutoGridItem({
    key: deserializedGridItem.state.key,
    body: deserializedGridItem.state.body,
    variableName: deserializedGridItem.state.variableName,
  });
}

export function getDashboardGridItemFromClipboard(scene: DashboardScene, gridCell: GridCell | null): DashboardGridItem {
  const deserializedGridItem = getGridItemFromClipboard(scene);

  if (deserializedGridItem instanceof DashboardGridItem) {
    if (gridCell) {
      // reposition to the given grid cell to avoid overlapping existing items
      deserializedGridItem.setState({ x: gridCell.x, y: gridCell.y });
    }
    return deserializedGridItem;
  }

  deserializedGridItem.state.body.clearParent();

  return new DashboardGridItem({
    ...gridCell,
    key: deserializedGridItem.state.key,
    body: deserializedGridItem.state.body,
    variableName: deserializedGridItem.state.variableName,
  });
}
