import { useEffect, useRef } from 'react';

import { SceneObject } from '@grafana/scenes';

import { DashboardLayoutManager, isDashboardLayoutManager } from '../types/DashboardLayoutManager';

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
  noAutoFocus?: boolean;
}

export function useEditPaneInputAutoFocus({ noAutoFocus }: EditPaneInputAutoFocusProps = {}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current && !noAutoFocus) {
      // Need the setTimeout here for some reason
      setTimeout(() => ref.current?.focus(), 200);
    }
  }, [noAutoFocus]);

  return ref;
}
