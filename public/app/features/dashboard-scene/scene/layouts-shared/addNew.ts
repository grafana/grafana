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

export function addNewTabTo(layout: DashboardLayoutManager): TabItem {
  if (layout instanceof TabsLayoutManager) {
    const tab = layout.addNewTab();
    layout.publishEvent(new NewObjectAddedToCanvasEvent(tab), true);
    return tab;
  }

  const layoutParent = layout.parent!;
  if (!isLayoutParent(layoutParent)) {
    throw new Error('Parent layout is not a LayoutParent');
  }

  const tabsLayout = TabsLayoutManager.createFromLayout(layoutParent.getLayout());
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
      const row = layout.addNewRow();
      layout.publishEvent(new NewObjectAddedToCanvasEvent(row), true);
      return row;
    } else {
      throw new Error('New dashboard layouts feature not enabled but new layout found');
    }
  }

  if (layout instanceof RowsLayoutManager) {
    const row = layout.addNewRow();
    layout.publishEvent(new NewObjectAddedToCanvasEvent(row), true);
    return row;
  }

  if (layout instanceof TabsLayoutManager) {
    const currentTab = layout.getCurrentTab();
    return addNewRowTo(currentTab.state.layout);
  }

  // If we want to add a row and current layout is custom grid or auto we migrate to rows layout
  // And wrap current layout in a row

  const layoutParent = layout.parent!;
  if (!isLayoutParent(layoutParent)) {
    throw new Error('Parent layout is not a LayoutParent');
  }

  const rowsLayout = RowsLayoutManager.createFromLayout(layoutParent.getLayout());
  layoutParent.switchLayout(rowsLayout);

  const row = rowsLayout.state.rows[0];
  layout.publishEvent(new NewObjectAddedToCanvasEvent(row), true);

  return row;
}
