// @returns true if the panel is a valid library panel reference
// a valid library panel reference is a panel with this
// property: `libraryPanel: {name: string, uid: string}`
import type { Panel } from '@grafana/schema/dist/esm/veneer/dashboard.types';
import { V1_PANEL_PROPERTIES } from 'app/features/dashboard-scene/utils/hasLibraryPanelsInV1Dashboard';

export function isValidLibraryPanelRef(panel: Panel): boolean {
  return (
    (V1_PANEL_PROPERTIES.LIBRARY_PANEL in panel &&
      panel.libraryPanel &&
      Boolean(panel.libraryPanel?.uid && panel.libraryPanel?.name)) ||
    false
  );
}
