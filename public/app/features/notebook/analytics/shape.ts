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
  const datasourceTypes = [
    ...new Set(panels.map(datasourceTypeOf).filter((type): type is string => type !== undefined)),
  ];

  return {
    cellCount: cells.length,
    cellsByType,
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
 * Reads the panel that "Add to notebook" is sending. Read off the spec rather than off a VizPanel
 * like readNotebookShape does, because the target notebook is not open and has no scene.
 *
 * Whether the panel came from the library is not in here. The dashboard builder inlines a loaded
 * library panel, so the element it returns says 'Panel' either way, and the caller has to pass that
 * fact in from the panel it started with.
 */
export function readAddedPanelShape(panel: PanelElement): AddedPanelShape {
  if (panel.kind === 'LibraryPanel') {
    // All the notebook stores for a library panel that had not finished loading is a reference, so
    // the visualization and the queries are not here to read.
    return { panelType: '', datasourceTypes: [], queryCount: 0 };
  }

  const queries = panel.spec.data.spec.queries;

  return {
    panelType: panel.spec.vizConfig.group,
    // A query with no datasource chosen carries an empty group, and is skipped the same way
    // readNotebookShape skips a panel with no datasource.
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
  return datasourceTypeOf(panel) !== undefined;
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

function datasourceTypeOf(panel: VizPanel): string | undefined {
  return getQueryRunnerFor(panel)?.state.datasource?.type;
}
