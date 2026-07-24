import { useEffect, useRef } from 'react';

import { isRenderTarget } from 'app/features/dashboard/services/isRenderTarget';

import { type DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isLayoutParent } from '../types/LayoutParent';

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
  // Never lazy load panels when the page is being captured by the image renderer.
  // Detection relies on the chromedp binding (ground truth) with `authenticatedBy === 'render'`
  // as legacy fallback — the latter alone is not reliably populated on render tokens, which
  // left lazy loading active during PDF capture and produced reports with blank
  // below-the-fold panels. Normal browser views (including /embedded/) are unaffected.
  return !(preload || isRenderTarget());
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
