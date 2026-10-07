import { type SceneObject } from '@grafana/scenes';

import { type NotebookCellItem } from './NotebookCellItem';

/** A brand check, not `instanceof` — see isNotebookLayoutManager's own doc comment for why. */
export function isNotebookCellItem(obj: SceneObject): obj is NotebookCellItem {
  return 'isNotebookCell' in obj;
}
