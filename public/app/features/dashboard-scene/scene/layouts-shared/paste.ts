import {
  DashboardV2Spec,
  RowsLayoutRowKind,
  TabsLayoutTabKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { LS_PANEL_COPY_KEY, LS_ROW_COPY_KEY, LS_TAB_COPY_KEY } from 'app/core/constants';
import store from 'app/core/store';

import { NewObjectAddedToCanvasEvent } from '../../edit-pane/shared';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isLayoutParent } from '../types/LayoutParent';

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

export function pasteTabTo(layout: DashboardLayoutManager, tab: TabItem): TabItem {
  const layoutParent = layout.parent!;
  if (!isLayoutParent(layoutParent)) {
    throw new Error('Parent layout is not a LayoutParent');
  }

  if (layout instanceof TabsLayoutManager) {
    return layout.addNewTab(tab);
  }

  // Create new tabs layout and wrap the current layout in the first tab

  if (layoutParent.getLayout().isEmpty()) {
    const tabsLayout = TabsLayoutManager.createEmpty();
    tabsLayout.state.tabs[0].setState(tab.state);
    layoutParent.switchLayout(tabsLayout);
    return tabsLayout.state.tabs[0];
  }

  const tabsLayout = TabsLayoutManager.createEmpty();
  tabsLayout.state.tabs[0].setState({ layout: layout.clone() });

  layoutParent.switchLayout(tabsLayout);

  const newTab = tabsLayout.state.tabs[0];
  layout.publishEvent(new NewObjectAddedToCanvasEvent(newTab), true);

  return tabsLayout.addNewTab(tab);
}

export function pasteRowTo(layout: DashboardLayoutManager, row: RowItem): RowItem {
  if (layout instanceof RowsLayoutManager) {
    return layout.addNewRow(row);
  }

  if (layout instanceof TabsLayoutManager) {
    const currentTab = layout.getCurrentTab();
    return pasteRowTo(currentTab.state.layout, row);
  }

  const layoutParent = layout.parent!;
  if (!isLayoutParent(layoutParent)) {
    throw new Error('Parent layout is not a LayoutParent');
  }

  if (layoutParent.getLayout().isEmpty()) {
    const rowsLayout = RowsLayoutManager.createEmpty();
    rowsLayout.state.rows[0].setState(row.state);
    layoutParent.switchLayout(rowsLayout);
    return rowsLayout.state.rows[0];
  }

  const rowsLayout = RowsLayoutManager.createFromLayout(layoutParent.getLayout());
  layoutParent.switchLayout(rowsLayout);

  const newRow = rowsLayout.state.rows[0];
  layout.publishEvent(new NewObjectAddedToCanvasEvent(newRow), true);
  return pasteRowTo(rowsLayout, row);
}
