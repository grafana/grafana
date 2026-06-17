import type { DashboardGridItem } from 'app/features/dashboard-scene/scene/layout-default/DashboardGridItem';

export function calculateGridItemDimensions(repeater: DashboardGridItem) {
  const rowCount = Math.ceil(repeater.getChildCount() / repeater.getMaxPerRow());
  const columnCount = Math.ceil(repeater.getChildCount() / rowCount);
  const w = 24 / columnCount;
  const h = repeater.state.itemHeight ?? 10;
  return { h, w, columnCount };
}
