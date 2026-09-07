import { type SceneObject } from '@grafana/scenes';

import { type NotebookLayoutManager } from './NotebookLayoutManager';

/**
 * Deliberately its own module, and deliberately a brand check rather than an `instanceof`.
 *
 * A cell needs to reach the layout manager that owns it, but the manager already imports and
 * constructs NotebookCellItem — so importing the class back, which is what `sceneGraph.getAncestor`
 * requires, would close a runtime import cycle. CI fails a PR whose circular-dependency count exceeds
 * main's, so that would not merge.
 *
 * Importing only the *type* keeps the runtime graph one-directional. Same shape and same reason as
 * `isDashboardLayoutManager`, and as `getLayoutManagerFor`, which was split into its own module to
 * avoid exactly this.
 */
export function isNotebookLayoutManager(obj: SceneObject): obj is NotebookLayoutManager {
  return 'isNotebookLayoutManager' in obj;
}
