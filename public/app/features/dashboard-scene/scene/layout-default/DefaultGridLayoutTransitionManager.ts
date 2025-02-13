import { SceneGridLayout, SceneGridRow } from '@grafana/scenes';
import { GRID_COLUMN_COUNT } from 'app/core/constants';

import {
  DashboardOutlineItem,
  DashboardOutlineItemType,
  DashboardOutlinePanelItem,
  DashboardOutlineRowItem,
  DashboardOutlineTabItem,
} from '../../outline/types';
import { getGridItemKeyForPanelId, getVizPanelKeyForPanelId } from '../../utils/utils';
import { DashboardLayoutManager, TransitionManager } from '../types/DashboardLayoutManager';

import { DashboardGridItem } from './DashboardGridItem';
import { DefaultGridLayoutManager } from './DefaultGridLayoutManager';
import { RowRepeaterBehavior } from './RowRepeaterBehavior';
import { RowActions } from './row-actions/RowActions';

const panelHeight = 10;
const panelWidth = GRID_COLUMN_COUNT / 3;

export class DefaultGridLayoutTransitionManager implements TransitionManager {
  public transitionFrom(layout: DashboardLayoutManager): DefaultGridLayoutManager {
    let children: Array<DashboardGridItem | SceneGridRow> = [];
    const outline = layout.getOutline();

    switch (layout.descriptor.id) {
      case 'rows-layout':
        //not very happy with theses checks...
        if (!outline.every((config) => config.type === DashboardOutlineItemType.ROW)) {
          throw new Error('Child is not a row, invalid scene');
        }

        children = this.fromRows(outline);
        break;
      case 'tabs-layout':
        //not very happy with theses checks...
        if (!outline.every((config) => config.type === DashboardOutlineItemType.TAB)) {
          throw new Error('Child is not a tab, invalid scene');
        }

        children = this.fromTabs(outline);
        break;
      case 'responsive-grid':
        children = this.fromResponsiveGrid(outline);
        break;
    }

    return new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: children,
        isDraggable: true,
        isResizable: true,
      }),
    });
  }

  // All from methods set reference objects for x, y and key to keep track of the current position
  // as we convert the outline to a grid layout.
  // We need to properly set the x and y values so the grid looks as expected.
  // We also need to re-do the keying structure because moving from a Rows layout to
  // a grid layout will mean we turn each RowItem into a SceneGridRow, and SceneGridRows adhere to
  // the same keying rules as panels, while RowItems have no key
  // e.g.: a gridItem with grid-item-1 key in a RowItem, when converted to a grid layout
  // will keep it's key grid-item-1, and will be a child of the newly create SceneGridRow
  // which will have a key of grid-item-2, which doesn't make sense, normally the row would be grid-item-1
  // and the panel grid-item-2, thus we need to re-key

  // Each of these from methods adhere to strict rules by design, so
  // in the case of a row layout the only valid layout combos are:
  //  - rows with panels or
  //  - rows with tabs with panels (which might get further limited as discussions progress)
  // if rows have panels it's easy we just pick the panels, and if there are tabs we ignore them
  // and concat all the rown in that layout.
  // We won't allow deeper nesting than 2 levels, so rows into tabs is the deepest it will go, no point
  // in checking whether the tab inside a row has any other tab/row/layout inside it, we just pick the panels.
  // getPanelsOnly goes through all the children and fetches only the panels, works recursively.
  private fromRows(configs: DashboardOutlineRowItem[]): Array<DashboardGridItem | SceneGridRow> {
    const children: Array<DashboardGridItem | SceneGridRow> = [];

    const currentY = { val: 0 };
    const key = { val: 0 };

    for (const config of configs) {
      if (config.type === 'row') {
        children.push(this.convertRow(config, key, currentY));
      }
    }

    return children;
  }

  // For tabs we flatten the children and go through each child.
  // Think of tabs as splittened dashboards, so we just append all tabs togeter to create
  // one big dashboard
  // We don't care about the tab layout, we just want the panels and rows
  // to also keep some sense of things, we move all non-rows at the front of the dashboard
  private fromTabs(configs: DashboardOutlineTabItem[]): Array<DashboardGridItem | SceneGridRow> {
    const rowGridItems: SceneGridRow[] = [];
    const panelGridItems: DashboardGridItem[] = [];

    const currentY = { val: 0 };
    const currentX = { val: 0 };
    const key = { val: 0 };

    const allChildren = configs.flatMap((config) => config.children);

    allChildren
      .filter((child) => child.type === DashboardOutlineItemType.PANEL)
      .forEach((child) => panelGridItems.push(this.convertPanel(child, key, currentX, currentY)));

    allChildren
      .filter((child) => child.type === DashboardOutlineItemType.ROW)
      .forEach((child) => rowGridItems.push(this.convertRow(child, key, currentY)));

    return [...panelGridItems, ...rowGridItems];
  }

  private fromResponsiveGrid(configs: DashboardOutlineItem[]): DashboardGridItem[] {
    const children: DashboardGridItem[] = [];

    const currentY = { val: 0 };
    const currentX = { val: 0 };
    const key = { val: 0 };

    for (let config of configs) {
      if (config.type !== DashboardOutlineItemType.PANEL) {
        throw new Error('Child is not a panel, invalid scene');
      }

      children.push(this.convertPanel(config, key, currentX, currentY));
    }

    return children;
  }

  private convertPanel(
    panel: DashboardOutlinePanelItem,
    key: { val: number },
    x: { val: number },
    y: { val: number }
  ): DashboardGridItem {
    // clear scene parent to move in new layout
    // also update the key
    panel.item.clearParent();
    panel.item.setState({ key: getVizPanelKeyForPanelId(key.val) });

    const gridItem = new DashboardGridItem({
      key: getGridItemKeyForPanelId(key.val),
      x: x.val,
      y: y.val,
      width: panelWidth,
      height: panelHeight,
      body: panel.item,
    });

    key.val += 1;
    x.val += panelWidth;

    if (x.val + panelWidth > GRID_COLUMN_COUNT) {
      x.val = 0;
      y.val += panelHeight;
    }

    return gridItem;
  }

  private convertRow(row: DashboardOutlineRowItem, key: { val: number }, y: { val: number }): SceneGridRow {
    const repeat = row.item.getRepeatVariable();
    const x = { val: 0 };

    // at this point we don't care what other layouts are inside
    // the row, we just want to get the panels
    // so if the row has a tabs layout within, we don't care
    // about the tabs layout
    const panels = this.getPanelsOnly(row.children);

    const gridRow = new SceneGridRow({
      y: y.val++,
      key: getGridItemKeyForPanelId(key.val++),
      isCollapsed: row.item.state.isCollapsed,
      title: row.item.state.title,
      //handle repeats
      $behaviors: repeat ? [new RowRepeaterBehavior({ variableName: repeat })] : [],
      actions: new RowActions({}),
      children: panels.map((panelItem) => {
        return this.convertPanel(panelItem, key, x, y);
      }),
    });

    return gridRow;
  }

  private getPanelsOnly(configs: DashboardOutlineItem[]): DashboardOutlinePanelItem[] {
    const panels: DashboardOutlinePanelItem[] = [];

    for (const config of configs) {
      if (config.type === DashboardOutlineItemType.PANEL) {
        panels.push(config);

        continue;
      }

      panels.push(...this.getPanelsOnly(config.children));
    }

    return panels;
  }
}
