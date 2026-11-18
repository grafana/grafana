import { isEqual } from 'lodash';

import { type VizPanel } from '@grafana/scenes';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';

import {
  DashboardInteractions,
  type PanelSettingDetails,
  type PanelSettingItem,
  type PanelSettingSource,
} from './interactions';
import { getDashboardSceneFor } from './utils';
import { getPanelIdForVizPanel } from './utils-panels';

/**
 * Reports a committed panel setting change. Call it only when the value really changed.
 * Without a source, the surface is inferred: the same option components render in the edit pane and the panel editor.
 */
export function trackPanelSettingChange(
  panel: VizPanel,
  item: PanelSettingItem,
  source?: PanelSettingSource,
  details: PanelSettingDetails = {}
) {
  // Without a key there is no panel id to report, and analytics must not break the change being made.
  if (!panel.state.key) {
    return;
  }

  DashboardInteractions.panelSettingChanged({
    item,
    source: source ?? (getDashboardSceneFor(panel).state.editPanel ? 'panel_editor' : 'edit_pane'),
    panel_type: panel.state.pluginId,
    panel_id: getPanelIdForVizPanel(panel),
    ...details,
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

  // A reorder keeps the same links the same number of times, so compare them as sorted lists.
  const isReorder = isEqual(sortedByContent(prev), sortedByContent(next));
  return isReorder ? 'reorder_panel_links' : 'edit_panel_link';
}

function sortedByContent(links: unknown[]): string[] {
  return links.map((link) => JSON.stringify(sortedDeepCloneWithoutNulls(link))).sort();
}
