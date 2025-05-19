import {
  AutoGridLayoutItemKind,
  Spec as DashboardV2Spec,
  GridLayoutItemKind,
  RowsLayoutRowKind,
  TabsLayoutTabKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { LS_PANEL_COPY_KEY, LS_ROW_COPY_KEY, LS_TAB_COPY_KEY } from 'app/core/constants';
import store from 'app/core/store';

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
  const panelIdGenerator = getPanelIdGenerator(dashboardSceneGraph.getNextPanelId(scene));

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
  const panelIdGenerator = getPanelIdGenerator(dashboardSceneGraph.getNextPanelId(scene));
  let tab;
  try {
    tab = deserializeTab(jsonObj.tab, jsonObj.elements, false, panelIdGenerator);
  } catch (error) {
    throw new Error('Error pasting tab from clipboard, please try to copy again');
  }

  return tab;
}

export function getPanelFromClipboard(scene: DashboardScene): DashboardGridItem | AutoGridItem {
  const jsonData = store.get(LS_PANEL_COPY_KEY);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const { elements, gridItem }: PanelStore = JSON.parse(jsonData) as PanelStore;

  if (gridItem.kind === 'GridLayoutItem') {
    return deserializeGridItem(gridItem, elements, getPanelIdGenerator(dashboardSceneGraph.getNextPanelId(scene)));
  }
  return deserializeAutoGridItem(gridItem, elements, getPanelIdGenerator(dashboardSceneGraph.getNextPanelId(scene)));
}

export function getAutoGridItemFromClipboard(scene: DashboardScene): AutoGridItem {
  const panel = getPanelFromClipboard(scene);
  if (panel instanceof AutoGridItem) {
    return panel;
  }
  // Convert to AutoGridItem
  return new AutoGridItem({ body: panel.state.body, key: panel.state.key, variableName: panel.state.variableName });
}

export function getDashboardGridItemFromClipboard(scene: DashboardScene, gridCell: GridCell | null): DashboardGridItem {
  const panel = getPanelFromClipboard(scene);
  if (panel instanceof DashboardGridItem) {
    return panel;
  }
  // Convert to DashboardGridItem
  return new DashboardGridItem({
    ...gridCell,
    body: panel.state.body,
    key: panel.state.key,
    variableName: panel.state.variableName,
  });
}

function getPanelIdGenerator(start: number) {
  let id = start;
  return () => id++;
}
