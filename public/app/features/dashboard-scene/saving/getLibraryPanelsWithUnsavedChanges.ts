import { sceneGraph, type SceneObject, VizPanel } from '@grafana/scenes';

import { isRepeatCloneOrChildOf } from '../utils/clone';
import { getLibraryPanelBehavior } from '../utils/utils';

/**
 * Library panels whose options were changed outside the panel editor and not yet saved to the library.
 * These changes are not part of the dashboard save model.
 */
export function getLibraryPanelsWithUnsavedChanges(root: SceneObject): VizPanel[] {
  return sceneGraph
    .findAllObjects(root, (obj) => obj instanceof VizPanel && !isRepeatCloneOrChildOf(obj))
    .filter((obj): obj is VizPanel => obj instanceof VizPanel)
    .filter((panel) => getLibraryPanelBehavior(panel)?.hasUnsavedOptionChanges() === true);
}
