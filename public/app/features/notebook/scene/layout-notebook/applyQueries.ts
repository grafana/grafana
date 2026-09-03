import { type SceneQueryRunner } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';

import { type NotebookCellItem } from './NotebookCellItem';
import { setQueryRunnerQueries } from './setQueryRunnerQueries';

/**
 * Routes a query-array write through the owning cell's undo/redo-aware entry points when a cell is
 * known, falling back to a raw setState when it isn't (e.g. no notebook scene above, or a panel
 * rendered outside a notebook cell entirely — see PanelQueryEditor's own `cell` prop doc comment).
 * Passing `discreteLabel` selects a one-shot, non-coalesced edit action (add/remove/duplicate a row,
 * switch datasource); omitting it selects the coalesced same-row text-edit path used while typing in
 * the query editor.
 */
export function applyQueries(
  cell: NotebookCellItem | undefined,
  queryRunner: SceneQueryRunner,
  queries: DataQuery[],
  discreteLabel?: string
): void {
  if (!cell) {
    setQueryRunnerQueries(queryRunner, queries);
    return;
  }
  if (discreteLabel) {
    cell.onQueryStructureChange(discreteLabel, queries);
  } else {
    cell.onQueryChange(queries);
  }
}
