import { sceneGraph, type SceneObject } from '@grafana/scenes';

import { type DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isRowItem, isTabItem, type RowItemLike } from '../types/LayoutItemTypeGuards';

function getRepeatSourceKey(object: SceneObject): string | undefined {
  return 'repeatSourceKey' in object.state && typeof object.state.repeatSourceKey === 'string'
    ? object.state.repeatSourceKey
    : undefined;
}

/**
 * Row slugs are only unique among siblings, so the url value is the row's slug prefixed
 * with the slugs of all ancestor rows/tabs, e.g. `Row-2/Row-1` for a row nested in another row.
 *
 * Each segment is encodeURIComponent'd so a title containing `/` (e.g. `Foo/Bar` → `Foo%2FBar`)
 * cannot collide with a nested path (`Foo` + `Bar` → `Foo/Bar`).
 */
export function getRowSlugPath(row: RowItemLike): string {
  const segments = [row.getSlug()];

  let previous: SceneObject = row;
  let ancestor = row.parent;
  while (ancestor) {
    if (isRowItem(ancestor) || isTabItem(ancestor)) {
      // Repeat clones are parented under their source row/tab in the scene graph
      // (they live in its repeatedRows/repeatedTabs state), but they render as siblings
      // of the source, so the source must not become a path segment.
      const repeatSourceKey = getRepeatSourceKey(previous);
      const ancestorIsRepeatSource = repeatSourceKey !== undefined && repeatSourceKey === ancestor.state.key;
      if (!ancestorIsRepeatSource) {
        segments.unshift(ancestor.getSlug());
      }
      previous = ancestor;
    }
    ancestor = ancestor.parent;
  }

  return segments.map(encodeURIComponent).join('/');
}

/** Returns whether a row matching the slug path was found */
export function scrollToRow(drow: string, layout: DashboardLayoutManager): boolean {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const row = (sceneGraph.findAllObjects(layout, isRowItem) as RowItemLike[]).find(
    (row) => getRowSlugPath(row) === drow
  );

  if (!row) {
    return false;
  }

  if (row.getCollapsedState()) {
    row.setCollapsedState(false);
  }

  row.scrollIntoView();
  return true;
}
