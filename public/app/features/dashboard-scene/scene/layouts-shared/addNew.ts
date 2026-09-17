import { config } from '@grafana/runtime';
import { type SceneGridRow } from '@grafana/scenes';

import { NewObjectAddedToCanvasEvent } from '../../sidebar/events';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { type RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { type TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { type DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isLayoutParent } from '../types/LayoutParent';
import { getDashboardSceneLike } from '../types/dashboard';

/**
 * Dashboard default layout to start the new group with, when the current layout holds nothing worth keeping.
 * Only grids qualify: rows and tabs carry structure the user built even while they contain no panels.
 */
function getDefaultLayoutForEmptyGrid(layout: DashboardLayoutManager): DashboardLayoutManager | undefined {
  if (!layout.descriptor.isGridLayout || layout.getVizPanels().length > 0) {
    return undefined;
  }

  const dashboard = getDashboardSceneLike(layout);
  const defaultLayout = dashboard.getDefaultLayout();

  // A template deserialized from preferences carries no edit-mode flags, so without this
  // panels in the new group would not be draggable/resizable until edit mode is re-entered
  if (dashboard.state.isEditing) {
    defaultLayout?.editModeChanged?.(true);
  }

  return defaultLayout;
}

function createTabsLayoutContaining(layout: DashboardLayoutManager): TabsLayoutManager {
  const tabsLayout = TabsLayoutManager.createEmpty();
  tabsLayout.state.tabs[0].setState({ layout });
  return tabsLayout;
}

function createRowsLayoutContaining(layout: DashboardLayoutManager): RowsLayoutManager {
  const rowsLayout = RowsLayoutManager.createEmpty();
  rowsLayout.state.rows[0].setState({ layout });
  return rowsLayout;
}

export function addNewTabTo(layout: DashboardLayoutManager): TabItem {
  const layoutParent = layout.parent!;
  if (!isLayoutParent(layoutParent)) {
    throw new Error('Parent layout is not a LayoutParent');
  }

  if (layout instanceof TabsLayoutManager) {
    return layout.addNewTab();
  }

  // Create new tabs layout and wrap the current layout in the first tab
  const layoutToWrap = getDefaultLayoutForEmptyGrid(layout) ?? layout.clone();
  const tabsLayout = createTabsLayoutContaining(layoutToWrap);
  const tab = tabsLayout.state.tabs[0];

  layoutParent.switchLayout(tabsLayout);

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

  const defaultLayout = getDefaultLayoutForEmptyGrid(layout);
  const rowsLayout = defaultLayout
    ? createRowsLayoutContaining(defaultLayout)
    : RowsLayoutManager.createFromLayout(layout);
  layoutParent.switchLayout(rowsLayout);

  const row = rowsLayout.state.rows[0];
  layout.publishEvent(new NewObjectAddedToCanvasEvent(row), true);

  return row;
}
