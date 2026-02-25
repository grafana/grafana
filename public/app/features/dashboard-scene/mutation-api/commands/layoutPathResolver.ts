/**
 * Layout Path Resolver
 *
 * Resolves string-based layout paths (e.g., "/rows/0", "/tabs/1/rows/2")
 * to the corresponding scene objects in the layout tree.
 *
 * Used by all layout mutation commands that accept a path parameter.
 */

import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { DashboardLayoutManager } from '../../scene/types/DashboardLayoutManager';

type GroupType = 'rows' | 'tabs';

export interface ResolvedPath {
  /** The layout manager at the resolved position (for "/" this is the root body). */
  layoutManager: DashboardLayoutManager;
  /** For row/tab paths: the RowItem or TabItem scene object. */
  item?: RowItem | TabItem;
  /** Index of the item within its parent's rows/tabs array. */
  index?: number;
}

/**
 * Parse a layout path string into segments.
 * "/" returns an empty array. "/rows/0" returns [{ type: "rows", index: 0 }].
 */
interface PathSegment {
  type: 'rows' | 'tabs';
  index: number;
}

function parsePathSegments(path: string): PathSegment[] {
  if (path === '/') {
    return [];
  }

  // Remove leading slash, then split into pairs
  const parts = path.slice(1).split('/');
  if (parts.length % 2 !== 0) {
    throw new Error(`Invalid layout path "${path}": expected /type/index pairs`);
  }

  const segments: PathSegment[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const type = parts[i];
    const indexStr = parts[i + 1];

    if (type !== 'rows' && type !== 'tabs') {
      throw new Error(`Invalid layout path "${path}": unknown segment type "${type}" (expected "rows" or "tabs")`);
    }

    const index = parseInt(indexStr, 10);
    if (isNaN(index) || index < 0) {
      throw new Error(`Invalid layout path "${path}": invalid index "${indexStr}"`);
    }

    segments.push({ type, index });
  }

  return segments;
}

/**
 * Resolve a layout path string to the corresponding scene objects.
 *
 * @param body - The root DashboardLayoutManager
 * @param path - Layout path string (e.g., "/", "/rows/0", "/tabs/1/rows/0")
 * @returns ResolvedPath with the layout manager and optional item/index
 */
export function resolveLayoutPath(body: DashboardLayoutManager, path: string): ResolvedPath {
  const segments = parsePathSegments(path);

  if (segments.length === 0) {
    return { layoutManager: body };
  }

  let currentLayout: DashboardLayoutManager = body;
  let lastItem: RowItem | TabItem | undefined;
  let lastIndex: number | undefined;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const isLast = i === segments.length - 1;

    if (segment.type === 'rows') {
      if (!(currentLayout instanceof RowsLayoutManager)) {
        const actualType = currentLayout.constructor.name;
        const pathSoFar =
          '/' +
          segments
            .slice(0, i + 1)
            .map((s) => `${s.type}/${s.index}`)
            .join('/');
        throw new Error(
          `Invalid layout path "${path}": expected RowsLayoutManager at "${pathSoFar}" but found ${actualType}`
        );
      }

      const rows = currentLayout.state.rows;
      if (segment.index >= rows.length) {
        const pathSoFar =
          '/' +
          segments
            .slice(0, i + 1)
            .map((s) => `${s.type}/${s.index}`)
            .join('/');
        throw new Error(
          `Invalid layout path "${path}": index ${segment.index} out of bounds at "${pathSoFar}" (${rows.length} rows)`
        );
      }

      const row = rows[segment.index];
      currentLayout = row.state.layout;

      if (isLast) {
        lastItem = row;
        lastIndex = segment.index;
      }
    } else {
      // tabs
      if (!(currentLayout instanceof TabsLayoutManager)) {
        const actualType = currentLayout.constructor.name;
        const pathSoFar =
          '/' +
          segments
            .slice(0, i + 1)
            .map((s) => `${s.type}/${s.index}`)
            .join('/');
        throw new Error(
          `Invalid layout path "${path}": expected TabsLayoutManager at "${pathSoFar}" but found ${actualType}`
        );
      }

      const tabs = currentLayout.state.tabs;
      if (segment.index >= tabs.length) {
        const pathSoFar =
          '/' +
          segments
            .slice(0, i + 1)
            .map((s) => `${s.type}/${s.index}`)
            .join('/');
        throw new Error(
          `Invalid layout path "${path}": index ${segment.index} out of bounds at "${pathSoFar}" (${tabs.length} tabs)`
        );
      }

      const tab = tabs[segment.index];
      currentLayout = tab.state.layout;

      if (isLast) {
        lastItem = tab;
        lastIndex = segment.index;
      }
    }
  }

  return {
    layoutManager: currentLayout,
    item: lastItem,
    index: lastIndex,
  };
}

/**
 * Returns true if any direct child of a group layout has an inner layout
 * that is itself a group (RowsLayoutManager or TabsLayoutManager).
 */
export function hasNestedGroups(layout: DashboardLayoutManager): boolean {
  if (layout instanceof RowsLayoutManager) {
    return layout.state.rows.some(
      (r) => r.state.layout instanceof RowsLayoutManager || r.state.layout instanceof TabsLayoutManager
    );
  }
  if (layout instanceof TabsLayoutManager) {
    return layout.state.tabs.some(
      (t) => t.state.layout instanceof RowsLayoutManager || t.state.layout instanceof TabsLayoutManager
    );
  }
  return false;
}

/**
 * Validate that adding a group layout (rows/tabs) at the given path
 * won't violate nesting rules:
 *  - Max 2 layers of group nesting (root group + one nested group)
 *  - No same-type nesting (tabs-in-tabs, rows-in-rows)
 */
export function validateNesting(parentPath: string, addingType: GroupType, targetLayout: DashboardLayoutManager): void {
  const segments = parsePathSegments(parentPath);

  // Already 2+ segments deep -- adding another group would exceed the limit
  if (segments.length >= 2) {
    throw new Error(
      `Cannot add ${addingType} at "${parentPath}": maximum nesting depth (2 group layers) would be exceeded.`
    );
  }

  // 1 segment deep -- check for same-type nesting
  if (segments.length === 1 && segments[0].type === addingType) {
    throw new Error(`Cannot add ${addingType} inside ${addingType}: same-type nesting is not allowed.`);
  }

  // Root level -- if conversion is needed and target already has nested groups,
  // wrapping it would create 3 layers
  if (segments.length === 0) {
    const isAlreadyTargetType =
      (addingType === 'rows' && targetLayout instanceof RowsLayoutManager) ||
      (addingType === 'tabs' && targetLayout instanceof TabsLayoutManager);

    if (!isAlreadyTargetType && hasNestedGroups(targetLayout)) {
      throw new Error(
        `Cannot add ${addingType} at root: the current layout already contains nested groups, ` +
          `which would exceed the maximum nesting depth (2 group layers).`
      );
    }
  }
}

/**
 * Resolve a path up to the parent level (one segment before the last).
 * Returns the parent layout manager and the last segment info.
 * Useful for operations that need to manipulate the parent (e.g., remove/insert).
 */
export function resolveParentPath(
  body: DashboardLayoutManager,
  path: string
): { parent: DashboardLayoutManager; segment: PathSegment } {
  const segments = parsePathSegments(path);

  if (segments.length === 0) {
    throw new Error(`Cannot resolve parent of root path "/"`);
  }

  const lastSegment = segments[segments.length - 1];

  if (segments.length === 1) {
    return { parent: body, segment: lastSegment };
  }

  // Resolve all segments except the last one
  const parentPath =
    '/' +
    segments
      .slice(0, -1)
      .map((s) => `${s.type}/${s.index}`)
      .join('/');
  const resolved = resolveLayoutPath(body, parentPath);

  return { parent: resolved.layoutManager, segment: lastSegment };
}
