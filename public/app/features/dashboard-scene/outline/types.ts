import { SceneGridRow, VizPanel } from '@grafana/scenes';

import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';

export enum DashboardOutlineItemType {
  TAB = 'tab',
  ROW = 'row',
  GRID_ROW = 'grid_row',
  PANEL = 'panel',
}

export interface DashboardOutlineTabItem {
  type: DashboardOutlineItemType.TAB;
  item: TabItem;
  children: DashboardOutlineItem[];
}

export interface DashboardOutlineRowItem {
  type: DashboardOutlineItemType.ROW;
  item: RowItem;
  children: DashboardOutlineItem[];
}

export interface DashboardOutlineGridRowItem {
  type: DashboardOutlineItemType.GRID_ROW;
  item: SceneGridRow;
  children: DashboardOutlineItem[];
}

export interface DashboardOutlinePanelItem {
  type: DashboardOutlineItemType.PANEL;
  item: VizPanel;
  children: never[];
}

export type DashboardOutlineItem =
  | DashboardOutlineTabItem
  | DashboardOutlineRowItem
  | DashboardOutlineGridRowItem
  | DashboardOutlinePanelItem;
