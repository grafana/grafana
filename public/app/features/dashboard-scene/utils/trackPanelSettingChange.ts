import { isEqual } from 'lodash';

import { type VizPanel } from '@grafana/scenes';

import { DashboardInteractions, type PanelSettingItem, type PanelSettingSource } from './interactions';
import { getDashboardSceneFor } from './utils';
import { getPanelIdForVizPanel } from './utils-panels';

/**
 * Reports a committed panel setting change. Call it only when the value really changed.
 * Without a source, the surface is inferred: the same option components render in the edit pane and the panel editor.
 */
export function trackPanelSettingChange(panel: VizPanel, item: PanelSettingItem, source?: PanelSettingSource) {
  DashboardInteractions.panelSettingChanged({
    item,
    source: source ?? (getDashboardSceneFor(panel).state.editPanel ? 'panel_editor' : 'edit_pane'),
    panel_type: panel.state.pluginId,
    panel_id: getPanelIdForVizPanel(panel),
  });
}

/**
 * The kind of change between two panel link lists, as the links editor reports them: one call per add, remove,
 * edit or drag. Returns undefined when nothing changed, for example a link saved without edits.
 */
export function getPanelLinksChange(prev: unknown[], next: unknown[]): PanelSettingItem | undefined {
  if (next.length > prev.length) {
    return 'add_panel_link';
  }
  if (next.length < prev.length) {
    return 'remove_panel_link';
  }
  if (isEqual(prev, next)) {
    return undefined;
  }

  const isReorder = next.every((link) => prev.some((prevLink) => isEqual(prevLink, link)));
  return isReorder ? 'reorder_panel_links' : 'edit_panel_link';
}
