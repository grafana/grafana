import { config } from '@grafana/runtime';
import { SceneGridRow } from '@grafana/scenes';

import { NewObjectAddedToCanvasEvent } from '../../edit-pane/shared';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isLayoutParent } from '../types/LayoutParent';

export function addNewTabTo(layout: DashboardLayoutManager, tab?: TabItem): TabItem {
  const layoutParent = layout.parent!;
  if (!isLayoutParent(layoutParent)) {
    throw new Error('Parent layout is not a LayoutParent');
  }

  if (layout instanceof TabsLayoutManager) {
    return layout.addNewTab(tab);
  }

  // Create new tabs layout and wrap the current layout in the first tab
  const tabsLayout = TabsLayoutManager.createEmpty();
  tabsLayout.state.tabs[0].setState({ layout: layout.clone() });

  layoutParent.switchLayout(tabsLayout);

  const newTab = tabsLayout.state.tabs[0];
  layout.publishEvent(new NewObjectAddedToCanvasEvent(newTab), true);

  tabsLayout.addNewTab(tab);

  return newTab;
}

export function addNewRowTo(layout: DashboardLayoutManager, row?: RowItem): RowItem | SceneGridRow {
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
    return layout.addNewRow(row);
  }

  if (layout instanceof TabsLayoutManager) {
    const currentTab = layout.getCurrentTab();
    return addNewRowTo(currentTab.state.layout, row);
  }

  const layoutParent = layout.parent!;
  if (!isLayoutParent(layoutParent)) {
    throw new Error('Parent layout is not a LayoutParent');
  }

  // If we want to add a row and current layout is custom grid or auto we migrate to rows layout
  // And wrap current layout in a row

  const rowsLayout = RowsLayoutManager.createFromLayout(layoutParent.getLayout());
  layoutParent.switchLayout(rowsLayout);

  const newRow = rowsLayout.state.rows[0];
  layout.publishEvent(new NewObjectAddedToCanvasEvent(newRow), true);

  rowsLayout.addNewRow(row);

  return newRow;
}
