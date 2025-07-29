import { useEffect, useRef } from 'react';

import { SceneObject } from '@grafana/scenes';
import { contextSrv } from 'app/core/core';

import { DashboardLayoutManager, isDashboardLayoutManager } from '../types/DashboardLayoutManager';
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

export function ungroupLayout(layout: DashboardLayoutManager, innerLayout: DashboardLayoutManager) {
  const layoutParent = layout.parent!;
  if (isLayoutParent(layoutParent)) {
    innerLayout.clearParent();
    layoutParent.switchLayout(innerLayout);
  }
}

export function getIsLazy(preload: boolean | undefined): boolean {
  return !(preload || contextSrv.user.authenticatedBy === 'render');
}
