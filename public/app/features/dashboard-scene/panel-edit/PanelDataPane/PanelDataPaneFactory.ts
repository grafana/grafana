import { type VizPanel } from '@grafana/scenes';

import { PanelDataPaneNext } from '../PanelEditNext/PanelDataPaneNext';

import { PanelDataAlertingTab } from './PanelDataAlertingTab';
import { PanelDataPane, shouldShowAlertingTab } from './PanelDataPane';
import { PanelDataQueriesTab } from './PanelDataQueriesTab';
import { PanelDataTransformationsTab } from './PanelDataTransformationsTab';
import { type PanelDataPaneTab, TabId } from './types';

/**
 * Create a data pane for the given panel.
 * @param panel The VizPanel to create the data pane for
 * @param useQueryEditorNext Signals whether to use the query editor v2 experience or the original (v1) experience.
 */
export function createPanelDataPane(panel: VizPanel, useQueryEditorNext: boolean | undefined) {
  const panelRef = panel.getRef();

  // Query experience v2
  if (useQueryEditorNext) {
    return new PanelDataPaneNext({ panelRef });
  }

  // Original experience
  const tabs: PanelDataPaneTab[] = [
    new PanelDataQueriesTab({ panelRef }),
    new PanelDataTransformationsTab({ panelRef }),
  ];

  if (shouldShowAlertingTab(panel.state.pluginId)) {
    tabs.push(new PanelDataAlertingTab({ panelRef }));
  }

  return new PanelDataPane({
    panelRef,
    tabs,
    tab: TabId.Queries,
  });
}
