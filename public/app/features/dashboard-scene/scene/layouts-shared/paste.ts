import {
  DashboardV2Spec,
  RowsLayoutRowKind,
  TabsLayoutTabKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { LS_PANEL_COPY_KEY, LS_ROW_COPY_KEY, LS_TAB_COPY_KEY } from 'app/core/constants';
import store from 'app/core/store';

import { deserializeRow } from '../../serialization/layoutSerializers/RowsLayoutSerializer';
import { deserializeTab } from '../../serialization/layoutSerializers/TabsLayoutSerializer';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { DashboardScene } from '../DashboardScene';
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

function getPanelIdGenerator(start: number) {
  let id = start;
  return () => id++;
}
