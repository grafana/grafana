import {
  Spec as DashboardV2Spec,
  GridLayoutItemKind,
  RowsLayoutRowKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';

/**
 * Normalizes backend output to match frontend behavior.
 * The backend sets repeat properties on library panel grid items from the library panel definition,
 * but the frontend only sets repeat when explicitly set on the panel instance.
 * This function removes repeat properties from library panel items where they weren't set on the instance.
 *
 * The difference in behavior is due to how the frontend conversion is done.
 * It is not feasible to fetch all library panels async in all cases where the transformation is done.
 * Library panel repeats will be set by the library panel behavior in those cases.
 *
 * This is a temporary solution until public dashboards and scripted dashboards have proper backend conversions.
 */
export function normalizeBackendOutputForFrontendComparison(
  backendSpec: DashboardV2Spec,
  inputPanels: Array<{
    id?: number;
    libraryPanel?: { uid?: string };
    repeat?: string;
    gridPos?: { w?: number; h?: number; x?: number; y?: number };
  }>
): DashboardV2Spec {
  // Deep clone the spec to avoid mutating the original
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const normalized = JSON.parse(JSON.stringify(backendSpec)) as DashboardV2Spec;

  // Create a map of panel ID to whether it has explicit repeat, original width, and if it's a library panel
  const panelHasExplicitRepeat = new Map<number, boolean>();
  const panelOriginalWidth = new Map<number, number>();
  const panelIsLibraryPanel = new Map<number, boolean>();
  inputPanels.forEach((panel) => {
    if (panel.id !== undefined) {
      panelHasExplicitRepeat.set(panel.id, !!panel.repeat);
      panelIsLibraryPanel.set(panel.id, !!panel.libraryPanel);
      if (panel.gridPos?.w !== undefined) {
        panelOriginalWidth.set(panel.id, panel.gridPos.w);
      }
    }
  });

  // Helper to recursively process grid items
  function processGridItems(items: GridLayoutItemKind[]): void {
    if (!Array.isArray(items)) {
      return;
    }

    items.forEach((item) => {
      if (item.spec?.element?.name) {
        // Extract panel ID from element name (format: "panel-{id}")
        const match = item.spec.element.name.match(/^panel-(\d+)$/);
        if (match) {
          const panelId = parseInt(match[1], 10);
          const hasExplicitRepeat = panelHasExplicitRepeat.get(panelId);
          const isLibraryPanel = panelIsLibraryPanel.get(panelId);

          // Only normalize library panels - check both input panel and element kind
          const element = normalized.elements?.[item.spec.element.name];
          const isElementLibraryPanel = element?.kind === 'LibraryPanel';

          // If this is a library panel item and repeat wasn't explicitly set on the instance,
          // remove the repeat property (backend adds it from library panel definition)
          // Also restore the original width when removing repeat properties
          if ((isLibraryPanel || isElementLibraryPanel) && hasExplicitRepeat === false && item.spec.repeat) {
            delete item.spec.repeat;
            // Always restore the original width from the input panel
            const originalWidth = panelOriginalWidth.get(panelId);
            if (originalWidth !== undefined) {
              item.spec.width = originalWidth;
            }
          }
        }
      }
    });
  }

  // Process GridLayout items
  if (normalized.layout?.kind === 'GridLayout' && normalized.layout.spec?.items) {
    processGridItems(normalized.layout.spec.items);
  }

  // Process RowsLayout items
  if (normalized.layout?.kind === 'RowsLayout' && normalized.layout.spec?.rows) {
    normalized.layout.spec.rows.forEach((row: RowsLayoutRowKind) => {
      if (row.spec?.layout?.kind === 'GridLayout' && row.spec.layout.spec?.items) {
        processGridItems(row.spec.layout.spec.items);
      }
    });
  }

  return normalized;
}
