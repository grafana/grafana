import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { type DashboardLayoutManager } from '../types/DashboardLayoutManager';

export function hasDirectTabsChild(layout: DashboardLayoutManager): boolean {
  if (!(layout instanceof RowsLayoutManager)) {
    return false;
  }

  for (const row of layout.state.rows) {
    if (row.getLayout() instanceof TabsLayoutManager) {
      return true;
    }
  }

  return false;
}
