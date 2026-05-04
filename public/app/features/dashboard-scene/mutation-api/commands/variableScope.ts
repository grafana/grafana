/**
 * Resolves which scene object owns template variables for mutation commands
 * (dashboard vs row/tab section scope).
 */

import type { DashboardScene } from '../../scene/DashboardScene';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { type DashboardLayoutManager } from '../../scene/types/DashboardLayoutManager';

import { resolveLayoutPath } from './layoutPathResolver';

export type VariableScopeOwner = DashboardScene | RowItem | TabItem;

export interface ResolvedVariableScope {
  owner: VariableScopeOwner;
  /** Layout path prefix for change paths, e.g. "" for dashboard or "/rows/0". */
  layoutPathPrefix: string;
}

export function resolveVariableScope(scene: DashboardScene, parentPath?: string): ResolvedVariableScope {
  const path = parentPath ?? '/';
  if (path === '/') {
    return { owner: scene, layoutPathPrefix: '' };
  }

  const resolved = resolveLayoutPath(scene.state.body, path);
  const item = resolved.item;
  if (!item || (!(item instanceof RowItem) && !(item instanceof TabItem))) {
    throw new Error(
      `Invalid variable scope "${path}": path must end at a row or tab (e.g. "/rows/0" or "/tabs/1/rows/0").`
    );
  }

  return { owner: item, layoutPathPrefix: path };
}

export function buildVariableChangePath(layoutPathPrefix: string, variableName: string): string {
  if (!layoutPathPrefix) {
    return `/variables/${variableName}`;
  }
  return `${layoutPathPrefix}/variables/${variableName}`;
}

/**
 * Returns layout paths (e.g. /rows/0) where a row or tab has a variable with the given name.
 */
export function findSectionPathsContainingVariable(scene: DashboardScene, name: string): string[] {
  const found: string[] = [];

  function visit(layout: DashboardLayoutManager, pathSoFar: string): void {
    if (layout instanceof RowsLayoutManager) {
      layout.state.rows.forEach((row, i) => {
        const p = pathSoFar === '/' ? `/rows/${i}` : `${pathSoFar}/rows/${i}`;
        if (row.state.$variables?.getByName(name)) {
          found.push(p);
        }
        visit(row.state.layout, p);
      });
    } else if (layout instanceof TabsLayoutManager) {
      layout.state.tabs.forEach((tab, i) => {
        const p = pathSoFar === '/' ? `/tabs/${i}` : `${pathSoFar}/tabs/${i}`;
        if (tab.state.$variables?.getByName(name)) {
          found.push(p);
        }
        visit(tab.state.layout, p);
      });
    }
  }

  visit(scene.state.body, '/');
  return found;
}
