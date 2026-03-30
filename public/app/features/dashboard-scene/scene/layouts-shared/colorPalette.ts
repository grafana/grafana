import { VizPanel } from '@grafana/scenes';

import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';

/**
 * Apply a color palette to all panels in a layout that do not have colorPaletteOverride set.
 * Panels with colorPaletteOverride=true have been explicitly configured by the user and are skipped.
 *
 * @param layout - The layout manager containing the panels to update.
 * @param paletteId - The color mode ID to apply (e.g. "palette-classic", "palette-ai-zeitgeist-v2").
 */
export function applyColorPaletteToLayout(layout: DashboardLayoutManager, paletteId: string): void {
  for (const panel of layout.getVizPanels()) {
    if (isPanelColorOverridden(panel)) {
      continue;
    }
    const fieldConfig = panel.state.fieldConfig;
    if (!fieldConfig) {
      continue;
    }
    panel.onFieldConfigChange(
      {
        ...fieldConfig,
        defaults: { ...fieldConfig.defaults, color: { mode: paletteId } },
      },
      true
    );
  }
}

/**
 * Mark a panel's color as user-overridden so future tab/row palette changes leave it alone.
 * The flag is stored on the parent layout item (DashboardGridItem or AutoGridItem) so it is
 * serialized with the dashboard layout, not the panel element.
 */
export function setPanelColorOverride(panel: VizPanel, overridden: boolean): void {
  const parent = panel.parent;
  if (parent instanceof DashboardGridItem || parent instanceof AutoGridItem) {
    parent.setState({ colorPaletteOverride: overridden });
  }
}

/**
 * Returns true when the parent layout item has colorPaletteOverride=true,
 * meaning the user explicitly chose this panel's color and it should be left alone.
 */
export function isPanelColorOverridden(panel: VizPanel): boolean {
  const parent = panel.parent;
  if (parent instanceof DashboardGridItem || parent instanceof AutoGridItem) {
    return parent.state.colorPaletteOverride === true;
  }
  return false;
}
