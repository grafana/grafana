import { useEffect, useRef } from 'react';

import { t } from '@grafana/i18n';
import { SceneObject } from '@grafana/scenes';
import appEvents from 'app/core/app_events';
import { contextSrv } from 'app/core/core';
import { ShowConfirmModalEvent, ShowModalReactEvent } from 'app/types/events';

import { ConvertMixedGridsModal } from '../layout-rows/ConvertMixedGridsModal';
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

export interface UngroupConfirmationOptions {
  hasNonGridLayout: boolean;
  gridTypes: Set<string>;
  onConfirm: (gridLayoutType: GridLayoutType) => void;
  onConvertMixedGrids: (availableIds: Set<string>) => void;
}

export function showUngroupConfirmation({
  hasNonGridLayout,
  gridTypes,
  onConfirm,
  onConvertMixedGrids,
}: UngroupConfirmationOptions) {
  if (hasNonGridLayout) {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('dashboard.layout.ungroup-nested-title', 'Ungroup nested groups?'),
        text: t('dashboard.layout.ungroup-nested-text', 'This will ungroup all nested groups.'),
        yesText: t('dashboard.layout.continue', 'Continue'),
        noText: t('dashboard.layout.cancel', 'Cancel'),
        onConfirm: () => {
          if (gridTypes.size > 1) {
            requestAnimationFrame(() => {
              onConvertMixedGrids(gridTypes);
            });
          } else {
            const gridLayoutType = mapIdToGridLayoutType(gridTypes.values().next().value);
            if (gridLayoutType) {
              onConfirm(gridLayoutType);
            }
          }
        },
      })
    );
    return;
  }

  if (gridTypes.size > 1) {
    onConvertMixedGrids(gridTypes);
    return;
  } else {
    const gridLayoutType = mapIdToGridLayoutType(gridTypes.values().next().value);
    if (gridLayoutType) {
      onConfirm(gridLayoutType);
    }
  }
}

export function showConvertMixedGridsModal(availableIds: Set<string>, onSelect: (id: string) => void) {
  appEvents.publish(
    new ShowModalReactEvent({
      component: ConvertMixedGridsModal,
      props: {
        availableIds,
        onSelect,
      },
    })
  );
}
