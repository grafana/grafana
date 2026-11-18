import { type SceneObject } from '@grafana/scenes';

import { type NotebookCellItem } from './NotebookCellItem';

export function isNotebookCell(cell: SceneObject | undefined): cell is NotebookCellItem {
  return Boolean(cell && 'isNotebookCell' in cell);
}
