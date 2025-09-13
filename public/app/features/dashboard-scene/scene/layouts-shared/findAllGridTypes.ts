import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';

export function findAllGridTypes(layout: DashboardLayoutManager): string[] {
  if (layout.descriptor.isGridLayout) {
    return [layout.descriptor.name];
  }

  if (layout instanceof TabsLayoutManager) {
    return layout.state.tabs.flatMap((tab) => findAllGridTypes(tab.getLayout()));
  } else if (layout instanceof RowsLayoutManager) {
    return layout.state.rows.flatMap((row) => findAllGridTypes(row.getLayout()));
  }

  return [];
}
