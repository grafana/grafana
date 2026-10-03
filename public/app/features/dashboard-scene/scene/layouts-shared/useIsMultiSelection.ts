import { useContext, useMemo } from 'react';

import { type SceneObject, VizPanel } from '@grafana/scenes';
import { ElementSelectionContext } from '@grafana/ui';

import { getDashboardSceneLike } from '../types/dashboard';

/**
 * Whether more than one element is currently selected on the dashboard canvas.
 * Canvas controls (add panel, group into row/tab, etc.) are hidden while a
 * multi-selection is active since they don't act on the selection.
 */
export function useIsMultiSelection(): boolean {
  const context = useContext(ElementSelectionContext);
  return (context?.selected.length ?? 0) > 1;
}

/**
 * Number of selected elements when the given element is part of the selection, 0 otherwise.
 */
export function useSelectionCountFor(id: string | undefined): number {
  const context = useContext(ElementSelectionContext);
  const selected = context?.selected ?? [];

  if (!id || !selected.some((item) => item.id === id)) {
    return 0;
  }

  return selected.length;
}

/**
 * The currently selected elements resolved to their scene objects, in selection order.
 */
export function useSelectedObjectsFor(sceneObject: SceneObject): SceneObject[] {
  const context = useContext(ElementSelectionContext);
  const selected = context?.selected;
  const sidebar = getDashboardSceneLike(sceneObject).state.sidebar;

  return useMemo(
    () =>
      (selected ?? [])
        .map((item) => sidebar.getSelectedObject(item.id))
        .filter((obj): obj is SceneObject => obj !== undefined),
    [selected, sidebar]
  );
}

export function useSelectedPanelsFor(sceneObject: SceneObject): VizPanel[] {
  const selected = useSelectedObjectsFor(sceneObject);
  return useMemo(() => selected.filter((obj) => obj instanceof VizPanel), [selected]);
}
