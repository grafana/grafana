import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { type DashboardLayoutManager } from '../types/DashboardLayoutManager';

export function containsTabsLayout(layout: DashboardLayoutManager): boolean {
  if (layout instanceof TabsLayoutManager) {
    return true;
  }

  if (layout instanceof RowsLayoutManager) {
    return layout.state.rows.some((row) => containsTabsLayout(row.getLayout()));
  }

  return false;
}
