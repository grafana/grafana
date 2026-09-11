import { useEffect, useRef } from 'react';

import { config } from '@grafana/runtime';
import { type VizPanel } from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';

import { type RowItem } from '../layout-rows/RowItem';
import { type TabItem } from '../layout-tabs/TabItem';
import { type DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isLayoutParent } from '../types/LayoutParent';
import { type LayoutRegistryItem } from '../types/LayoutRegistryItem';

export interface SidebarInputAutoFocusProps {
  autoFocus?: boolean;
}

export function useSidebarInputAutoFocus({ autoFocus }: SidebarInputAutoFocusProps = {}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current && autoFocus) {
      // Need the setTimeout here for some reason
      setTimeout(() => ref.current?.focus(), 200);
    }
  }, [autoFocus]);

  return ref;
}

export function generateUniqueTitle(title: string | undefined, existingTitles: Set<string>): string {
  const baseTitle = title ?? '';

  if (existingTitles.has(baseTitle)) {
    const titleMatch = baseTitle.match(/^(.*?)(\d+)$/);
    if (titleMatch) {
      // If title ends with a number, increment it
      const baseTitle = titleMatch[1];
      const currentNumber = parseInt(titleMatch[2], 10);
      let newTitle = `${baseTitle}${currentNumber + 1}`;

      // Keep incrementing until we find an unused title
      while (existingTitles.has(newTitle)) {
        const nextNumber = parseInt(newTitle.match(/\d+$/)![0], 10) + 1;
        newTitle = `${baseTitle}${nextNumber}`;
      }
      return newTitle;
    } else {
      // If title doesn't end with a number, append "1"
      let i = 1;
      let newTitle = `${baseTitle} ${i}`;
      while (existingTitles.has(newTitle)) {
        i++;
        newTitle = `${baseTitle} ${i}`;
      }
      return newTitle;
    }
  }

  return baseTitle;
}

export function deduplicateTitles(items: TabItem[] | RowItem[]) {
  const existingTitles = new Set<string>();

  for (const item of items) {
    if (!item.state.title) {
      continue;
    }

    const uniqueTitle = generateUniqueTitle(item.state.title, existingTitles);

    if (uniqueTitle !== item.state.title) {
      item.setState({ title: uniqueTitle });
    }

    existingTitles.add(uniqueTitle);
  }
}

function switchLayoutOnParent(current: DashboardLayoutManager, newLayout: DashboardLayoutManager, skipUndo?: boolean) {
  const layoutParent = current.parent;
  if (layoutParent && isLayoutParent(layoutParent)) {
    layoutParent.switchLayout(newLayout, skipUndo);
  }
}

export function changeLayoutTo(
  currentManager: DashboardLayoutManager,
  layoutItem: LayoutRegistryItem,
  skipUndo?: boolean
) {
  switchLayoutOnParent(currentManager, layoutItem.createFromLayout(currentManager), skipUndo);
}

export function ungroupLayout(layout: DashboardLayoutManager, innerLayout: DashboardLayoutManager, skipUndo?: boolean) {
  innerLayout.clearParent();
  switchLayoutOnParent(layout, innerLayout, skipUndo);
}

export function getIsLazy(preload: boolean | undefined): boolean {
  // The dashboard's own value is the only input. [dashboards] default_preload seeds this value when
  // a dashboard is created; it deliberately has no effect at load time, so turning it on never
  // changes how existing dashboards behave.
  // We don't want to lazy load panels in the case of image renderer
  return !(preload || (contextSrv.user && contextSrv.user.authenticatedBy === 'render'));
}

export enum GridLayoutType {
  AutoGridLayout = 'AutoGridLayout',
  GridLayout = 'GridLayout',
}

export function mapIdToGridLayoutType(id?: string): GridLayoutType | undefined {
  switch (id) {
    case GridLayoutType.AutoGridLayout:
      return GridLayoutType.AutoGridLayout;
    case GridLayoutType.GridLayout:
      return GridLayoutType.GridLayout;
    default:
      return undefined;
  }
}

/**
 * Given the sibling being removed and the full list of siblings it lived in, finds the nearest
 * remaining VizPanel to move keyboard focus to (next sibling first, then previous). Used so that
 * removing a panel doesn't drop keyboard/screen reader focus back to document.body.
 */
export function findAdjacentVizPanel<T>(
  removedSibling: T,
  siblings: T[],
  getPanel: (sibling: T) => VizPanel | undefined
): VizPanel | undefined {
  const index = siblings.indexOf(removedSibling);
  if (index === -1) {
    return undefined;
  }

  for (let i = index + 1; i < siblings.length; i++) {
    const panel = getPanel(siblings[i]);
    if (panel) {
      return panel;
    }
  }

  for (let i = index - 1; i >= 0; i--) {
    const panel = getPanel(siblings[i]);
    if (panel) {
      return panel;
    }
  }

  return undefined;
}

/**
 * Moves keyboard focus to the given panel's chrome. Deferred to the next animation frame because
 * the caller removes another panel from the layout first, and the DOM needs to reflect that
 * removal before we can safely move focus into what's left.
 */
export function focusVizPanel(panel: VizPanel | undefined): void {
  if (!panel) {
    return;
  }

  requestAnimationFrame(() => {
    const panelEl = document.querySelector<HTMLElement>(`[data-viz-panel-key="${panel.state.key}"] section`);
    panelEl?.focus();
  });
}
