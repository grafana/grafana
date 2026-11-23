import { createAssistantContextItem } from '@grafana/assistant';
import { type VizPanel } from '@grafana/scenes';
import { getPanelIdForVizPanel } from 'app/features/dashboard-scene/utils/utils-panels';

import { type NotebookCellItem } from './NotebookCellItem';

// Shape mirrors the assistant's own panel picker; elementName is what its notebook tools address cells by.
export function buildNotebookPanelAssistantContext(cell: NotebookCellItem, panel: VizPanel) {
  return [
    createAssistantContextItem('structured', {
      data: {
        name: `Panel: ${panel.state.title || cell.state.elementName}`,
        elementType: 'panel',
        panelId: String(getPanelIdForVizPanel(panel)),
        panelKey: panel.state.key,
        elementName: cell.state.elementName,
      },
    }),
  ];
}
