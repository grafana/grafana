import type { Dashboard, Panel, RowPanel } from '@grafana/schema/dist/esm/veneer/dashboard.types';
import { isValidLibraryPanelRef } from 'app/features/dashboard-scene/utils/isValidLibraryPanelRef';

export const V1_PANEL_PROPERTIES = {
  LIBRARY_PANEL: 'libraryPanel',
  COLLAPSED: 'collapsed',
} as const;

/**
 * Checks if a V1 dashboard contains library panels
 * @returns true if the dashboard contains library panels
 */
export function hasLibraryPanelsInV1Dashboard(dashboard: Dashboard | undefined): boolean {
  if (!dashboard?.panels) {
    return false;
  }

  return dashboard.panels.some((panel: Panel | RowPanel) => {
    if (isValidLibraryPanelRef(panel)) {
      return true;
    }
    // Check if this is a collapsed row containing library panels
    const isCollapsedRow =
      V1_PANEL_PROPERTIES.COLLAPSED in panel && panel.collapsed && 'panels' in panel && panel.panels;

    if (!isCollapsedRow) {
      return false;
    }

    return panel.panels.some(isValidLibraryPanelRef);
  });
}
