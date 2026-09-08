import { type SceneObject } from '@grafana/scenes';

import { type NotebookScene } from './NotebookScene';

/**
 * Checks for a field instead of using instanceof. NotebookScene creates the layout manager, so if the
 * manager imported NotebookScene back, the two files would import each other. isNotebookLayoutManager
 * exists for the same reason.
 */
export function isNotebookScene(obj: SceneObject): obj is NotebookScene {
  return 'isNotebookScene' in obj;
}
