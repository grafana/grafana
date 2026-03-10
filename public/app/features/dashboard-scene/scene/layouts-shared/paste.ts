import { store } from '@grafana/data';
import {
  AutoGridLayoutItemKind,
  Spec as DashboardV2Spec,
  GridLayoutItemKind,
  RowsLayoutRowKind,
  TabsLayoutTabKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { LS_PANEL_COPY_KEY, LS_ROW_COPY_KEY, LS_STYLES_COPY_KEY, LS_TAB_COPY_KEY } from 'app/core/constants';

import { deserializeAutoGridItem } from '../../serialization/layoutSerializers/AutoGridLayoutSerializer';
import { deserializeGridItem } from '../../serialization/layoutSerializers/DefaultGridLayoutSerializer';
import { deserializeRow } from '../../serialization/layoutSerializers/RowsLayoutSerializer';
import { deserializeTab } from '../../serialization/layoutSerializers/TabsLayoutSerializer';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { DashboardScene } from '../DashboardScene';
import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { GridCell } from '../layout-default/findSpaceForNewPanel';
import { RowItem } from '../layout-rows/RowItem';
import { TabItem } from '../layout-tabs/TabItem';

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
    throw new Error('Error pasting row from clipboard, please try to copy again');
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
    throw new Error('Error pasting tab from clipboard, please try to copy again');
  }

  return tab;
}

function getGridItemFromClipboard(scene: DashboardScene) {
  const jsonData = store.get(LS_PANEL_COPY_KEY);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const { elements, gridItem }: PanelStore = JSON.parse(jsonData) as PanelStore;

  let deserializedGridItem;
  try {
    deserializedGridItem =
      gridItem.kind === 'GridLayoutItem'
        ? deserializeGridItem(gridItem, elements, dashboardSceneGraph.getPanelIdGenerator(scene))
        : deserializeAutoGridItem(gridItem, elements, dashboardSceneGraph.getPanelIdGenerator(scene));
  } catch (error) {
    throw new Error('Error pasting panel from clipboard, please try to copy again');
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

// Always uses gridCell for positioning so pasting behaves like adding a new panel via findSpaceForNewPanel,
// rather than reusing the clipboard's original coordinates which could overlap existing panels.
export function getDashboardGridItemFromClipboard(scene: DashboardScene, gridCell: GridCell | null): DashboardGridItem {
  const deserializedGridItem = getGridItemFromClipboard(scene);

  deserializedGridItem.state.body.clearParent();

  const gridProps =
    deserializedGridItem instanceof DashboardGridItem
      ? {
          ...gridCell,
          width: deserializedGridItem.state.width,
          height: deserializedGridItem.state.height,
        }
      : gridCell;

  return new DashboardGridItem({
    ...gridProps,
    key: deserializedGridItem.state.key,
    body: deserializedGridItem.state.body,
    variableName: deserializedGridItem.state.variableName,
  });
}
