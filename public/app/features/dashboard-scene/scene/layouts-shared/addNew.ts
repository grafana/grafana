import { config } from '@grafana/runtime';
import { sceneGraph, SceneGridRow } from '@grafana/scenes';

import { NewObjectAddedToCanvasEvent } from '../../edit-pane/shared';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isLayoutParent } from '../types/LayoutParent';

export function addNewTabTo(layout: DashboardLayoutManager): TabItem {
  const layoutParent = layout.parent!;
  if (!isLayoutParent(layoutParent)) {
    throw new Error('Parent layout is not a LayoutParent');
  }

  // If layout parent is tab item we add new tab after it rather than create a nested tab
  if (layoutParent instanceof TabItem) {
    const tabsLayout = sceneGraph.getAncestor(layoutParent, TabsLayoutManager);
    return tabsLayout.addTabAfter(layoutParent);
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

  const layoutParent = layout.parent!;
  if (!isLayoutParent(layoutParent)) {
    throw new Error('Parent layout is not a LayoutParent');
  }

  // If adding we are adding a row to a row we add it below the current row
  if (layoutParent instanceof RowItem) {
    const rowsLayout = sceneGraph.getAncestor(layoutParent, RowsLayoutManager);
    return rowsLayout.addRowBelow(layoutParent);
  }

  if (layout instanceof RowsLayoutManager) {
    return layout.addNewRow();
  }

  if (layout instanceof TabsLayoutManager) {
    const currentTab = layout.getCurrentTab();
    return addNewRowTo(currentTab.state.layout);
  }

  // If we want to add a row and current layout is custom grid or auto we migrate to rows layout
  // And wrap current layout in a row

  const rowsLayout = RowsLayoutManager.createFromLayout(layoutParent.getLayout());
  layoutParent.switchLayout(rowsLayout);

  const row = rowsLayout.state.rows[0];
  layout.publishEvent(new NewObjectAddedToCanvasEvent(row), true);

  return row;
}
