import { useEffect, useRef } from 'react';

import { type SceneObject, type VizPanel } from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';

import { type DashboardLayoutManager, isDashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isLayoutParent } from '../types/LayoutParent';

export function findParentLayout(sceneObject: SceneObject): DashboardLayoutManager | null {
  let parent = sceneObject.parent;

  while (parent) {
    if (isDashboardLayoutManager(parent)) {
      return parent;
    }

    parent = parent.parent;
  }

  return null;
}

export interface EditPaneInputAutoFocusProps {
  autoFocus?: boolean;
}

export function useEditPaneInputAutoFocus({ autoFocus }: EditPaneInputAutoFocusProps = {}) {
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

export function ungroupLayout(layout: DashboardLayoutManager, innerLayout: DashboardLayoutManager, skipUndo?: boolean) {
  const layoutParent = layout.parent!;
  if (isLayoutParent(layoutParent)) {
    innerLayout.clearParent();
    layoutParent.switchLayout(innerLayout, skipUndo);
  }
}

export function getIsLazy(preload: boolean | undefined): boolean {
  // We don't want to lazy load panels in the case of image renderer
  return !(preload || (contextSrv.user && contextSrv.user.authenticatedBy === 'render'));
}

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

export function focusVizPanel(panel: VizPanel | undefined): void {
  if (!panel || typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') {
    return;
  }

  const key = panel.state.key;
  if (!key) {
    return;
  }

  // Wait one frame so React commits the removal and the confirm modal's
  // FloatingFocusManager has a chance to run its (now-failing) focus restore
  // before we move focus to the adjacent panel.
  requestAnimationFrame(() => {
    const target = document.querySelector<HTMLElement>(`[data-viz-panel-key="${CSS.escape(key)}"] section`);
    target?.focus();
  });
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
