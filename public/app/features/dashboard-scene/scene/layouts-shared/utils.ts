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
