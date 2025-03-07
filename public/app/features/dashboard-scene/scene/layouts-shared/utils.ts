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
  skip?: () => boolean;
}

export function useEditPaneInputAutoFocus({ skip }: EditPaneInputAutoFocusProps = {}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      // Need the setTimeout here for some reason
      setTimeout(() => {
        if (skip?.()) {
          return;
        }

        ref.current?.focus();
      }, 200);
    }
  }, [skip]);

  return ref;
}
