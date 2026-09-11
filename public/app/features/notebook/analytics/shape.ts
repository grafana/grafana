import { type VizPanel } from '@grafana/scenes';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';

import { type NotebookScene } from '../scene/NotebookScene';
import { type NotebookCellItem } from '../scene/layout-notebook/NotebookCellItem';
import { isEmptyMarkdown } from '../scene/layout-notebook/isEmptyMarkdown';
import { type PanelElement } from '../types';

import { type AddedPanelShape, type NotebookShape } from './types';

export function readNotebookShape(scene: NotebookScene): NotebookShape {
  const layout = scene.state.body;
  const cells = layout.contentCells();
  const panels = layout.getVizPanels();
  const cellsByType = cells.map(cellType);
  const datasourceTypes = [...new Set(panels.flatMap(datasourceTypesOf))];

  return {
    cellCount: cells.length,
    panelCount: panels.length,
    datasourceTypes,
    assistantCellCount: cells.filter((cell) => cell.state.source === 'assistant').length,
    nonEmptyCellCount: cells.filter(isNonEmptyCell).length,
    textCellCount: cellsByType.filter((type) => type === 'markdown').length,
    codeCellCount: cellsByType.filter((type) => type === 'code').length,
    configuredPanelCount: panels.filter(isConfiguredPanel).length,
    datasourceCount: datasourceTypes.length,
  };
}

/**
 * Reads the panel that "Add to notebook" sends. Reads the spec, not a VizPanel like
 * readNotebookShape does, because the target notebook is not open.
 *
 * The library flag is not here. The dashboard inlines a loaded library panel, so the element it
 * returns says 'Panel' either way.
 */
export function readAddedPanelShape(panel: PanelElement): AddedPanelShape {
  if (panel.kind === 'LibraryPanel') {
    // A library panel that had not finished loading is stored as a reference. It carries no
    // visualization and no queries.
    return { panelType: '', datasourceTypes: [], queryCount: 0 };
  }

  const queries = panel.spec.data.spec.queries;

  return {
    panelType: panel.spec.vizConfig.group,
    // A query with no datasource chosen carries an empty group. Skip it, as readNotebookShape
    // skips a panel with no datasource.
    datasourceTypes: [...new Set(queries.map((query) => query.spec.query.group).filter((group) => group !== ''))],
    queryCount: queries.length,
  };
}

// A panel cell only counts once it is configured. A freshly added visualization block still gets a
// synthetic placeholder query with no datasource, so its query runner is never empty. Datasource
// presence is the real signal, not queries.length.
//
// A narrative cell counts unless it is empty markdown nobody touched. A code cell always counts,
// because even an empty one carries a language choice somebody made.
function isNonEmptyCell(cell: NotebookCellItem): boolean {
  if (cell.state.body) {
    return isConfiguredPanel(cell.state.body);
  }
  return !isEmptyMarkdown(cell.state.content);
}

function isConfiguredPanel(panel: VizPanel): boolean {
  return datasourceTypesOf(panel).length > 0;
}

function cellType(cell: NotebookCellItem): string {
  if (cell.state.body) {
    return 'panel';
  }
  if (cell.state.content) {
    return cell.state.content.kind.toLowerCase();
  }
  // Never both, never neither, per NotebookCellItemState's own contract. This is defensive, not a
  // real cell shape.
  return 'unknown';
}

/**
 * The datasource plugin IDs a panel queries.
 *
 * Read from the queries, not from the query runner. A panel restored from a saved notebook has no
 * datasource on its runner, because v2 keeps one per query. getPanelDataSource sets the runner's
 * only when the queries disagree and it switches to Mixed.
 *
 * Writes inside a notebook go through setQueryRunnerQueries, which copies the first query's
 * datasource onto the runner. So the queries are the one place that always has it.
 */
function datasourceTypesOf(panel: VizPanel): string[] {
  const queries = getQueryRunnerFor(panel)?.state.queries ?? [];

  return queries.map((query) => query.datasource?.type).filter((type): type is string => type !== undefined);
}
