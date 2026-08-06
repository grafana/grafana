import { sceneGraph, type SceneObject } from '@grafana/scenes';

import { type DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isRowItem, isTabItem, type RowItemLike } from '../types/LayoutItemTypeGuards';

/**
 * Row slugs are only unique among siblings, so the url value is the row's slug prefixed
 * with the slugs of all ancestor rows/tabs, e.g. `Row-2/Row-1` for a row nested in another row.
 */
export function getRowSlugPath(row: RowItemLike): string {
  const segments = [row.getSlug()];

  let ancestor = row.parent;
  while (ancestor) {
    if (isRowItem(ancestor) || isTabItem(ancestor)) {
      segments.unshift(ancestor.getSlug());
    }
    ancestor = ancestor.parent;
  }

  return segments.join('/');
}

export function scrollToRow(srow: string, layout: DashboardLayoutManager) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const row = (sceneGraph.findAllObjects(layout, isRowItem) as RowItemLike[]).find(
    (row) => getRowSlugPath(row) === srow
  );

  if (!row) {
    return;
  }

  // The row might be nested inside collapsed rows - expand them all so it can render
  let ancestor: SceneObject | undefined = row;
  while (ancestor && ancestor !== layout) {
    if (isRowItem(ancestor) && ancestor.getCollapsedState()) {
      ancestor.setCollapsedState(false);
    }

    ancestor = ancestor.parent!;
  }

  row.scrollIntoView();
}
