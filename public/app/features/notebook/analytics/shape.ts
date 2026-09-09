import { type VizPanel } from '@grafana/scenes';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/utils';

import { type NotebookScene } from '../scene/NotebookScene';
import { type NotebookCellItem } from '../scene/layout-notebook/NotebookCellItem';
import { isEmptyMarkdown } from '../scene/layout-notebook/isEmptyMarkdown';

export interface NotebookShape {
  cellCount: number;
  cellsByType: string[];
  panelCount: number;
  datasourceTypes: string[];
  assistantCellCount: number;
  meaningfulCellCount: number;
  textCellCount: number;
  codeCellCount: number;
  configuredPanelCount: number;
  datasourceCount: number;
}

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
    meaningfulCellCount: cells.filter(isMeaningfulCell).length,
    textCellCount: cellsByType.filter((type) => type === 'markdown').length,
    codeCellCount: cellsByType.filter((type) => type === 'code').length,
    configuredPanelCount: panels.filter(isConfiguredPanel).length,
    datasourceCount: datasourceTypes.length,
  };
}

// A panel cell only counts once it is configured. A freshly added visualization block still gets a
// synthetic placeholder query with no datasource, so its query runner is never empty. Datasource
// presence is the real signal, not queries.length.
//
// A narrative cell counts unless it is empty markdown nobody touched. A code cell always counts,
// because even an empty one carries a language choice somebody made.
function isMeaningfulCell(cell: NotebookCellItem): boolean {
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
