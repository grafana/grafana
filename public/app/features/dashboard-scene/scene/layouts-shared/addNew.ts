import { config } from '@grafana/runtime';
import { type SceneGridRow } from '@grafana/scenes';

import { NewObjectAddedToCanvasEvent } from '../../edit-pane/shared';
import { getDashboardSceneFor } from '../../utils/utils';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { type RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { type TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { type DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isLayoutParent } from '../types/LayoutParent';

import { getRowFromClipboard, getTabFromClipboard } from './paste';

export function addNewTabTo(layout: DashboardLayoutManager): TabItem {
  const layoutParent = layout.parent!;
  if (!isLayoutParent(layoutParent)) {
    throw new Error('Parent layout is not a LayoutParent');
  }

  if (layout instanceof TabsLayoutManager) {
    return layout.addNewTab();
  }

  // Create new tabs layout and wrap the current layout in the first tab
  const tabsLayout = TabsLayoutManager.createEmpty();
  tabsLayout.state.tabs[0].setState({ layout: layout.clone() });

  layoutParent.switchLayout(tabsLayout);

  const tab = tabsLayout.state.tabs[0];
  layout.publishEvent(new NewObjectAddedToCanvasEvent(tab), true);

  return tab;
}

export function addNewRowTo(layout: DashboardLayoutManager): RowItem | SceneGridRow {
  /**
   * If new layouts feature is disabled we add old school rows to the custom grid layout
   */
  if (!config.featureToggles.dashboardNewLayouts) {
    if (layout instanceof DefaultGridLayoutManager) {
      return layout.addNewRow();
    } else {
      throw new Error('New dashboard layouts feature not enabled but new layout found');
    }
  }

  if (layout instanceof RowsLayoutManager) {
    return layout.addNewRow();
  }

  if (layout instanceof TabsLayoutManager) {
    const currentTab = layout.getCurrentTab();
    if (!currentTab) {
      throw new Error('Could find currently active tab');
    }
    return addNewRowTo(currentTab.state.layout);
  }

  const layoutParent = layout.parent!;
  if (!isLayoutParent(layoutParent)) {
    throw new Error('Parent layout is not a LayoutParent');
  }

  // If we want to add a row and current layout is custom grid or auto we migrate to rows layout
  // And wrap current layout in a row

  const rowsLayout = RowsLayoutManager.createFromLayout(layoutParent.getLayout());
  layoutParent.switchLayout(rowsLayout);

  const row = rowsLayout.state.rows[0];
  layout.publishEvent(new NewObjectAddedToCanvasEvent(row), true);

  return row;
}

export function pasteRowTo(layout: DashboardLayoutManager): void {
  const scene = getDashboardSceneFor(layout);

  if (layout instanceof RowsLayoutManager) {
    layout.pasteRow();
    return;
  }

  if (layout instanceof TabsLayoutManager) {
    const currentTab = layout.getCurrentTab();
    if (!currentTab) {
      throw new Error('Could not find currently active tab');
    }
    pasteRowTo(currentTab.state.layout);
    return;
  }

  const layoutParent = layout.parent!;
  if (!isLayoutParent(layoutParent)) {
    throw new Error('Parent layout is not a LayoutParent');
  }

  // Create a rows layout with only the pasted row (don't wrap existing content into an extra row)
  const row = getRowFromClipboard(scene);
  const rowsLayout = new RowsLayoutManager({ rows: [row] });
  layoutParent.switchLayout(rowsLayout);
  layout.publishEvent(new NewObjectAddedToCanvasEvent(row), true);
}

export function pasteTabTo(layout: DashboardLayoutManager): void {
  const scene = getDashboardSceneFor(layout);

  if (layout instanceof TabsLayoutManager) {
    layout.pasteTab();
    return;
  }

  const layoutParent = layout.parent!;
  if (!isLayoutParent(layoutParent)) {
    throw new Error('Parent layout is not a LayoutParent');
  }

  // Create a tabs layout with only the pasted tab (don't wrap existing content into an extra tab)
  const tab = getTabFromClipboard(scene);
  const tabsLayout = new TabsLayoutManager({ tabs: [tab] });
  layoutParent.switchLayout(tabsLayout);
  layout.publishEvent(new NewObjectAddedToCanvasEvent(tab), true);
}
