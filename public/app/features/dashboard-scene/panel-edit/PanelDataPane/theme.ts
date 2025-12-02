/**
 * Custom accent colors for the Panel Data Pane card types.
 */
export const PANEL_DATA_PANE_COLORS = {
  query: '#FF8904', // Orange
  expression: '#C27AFF', // Purple
  transform: '#00D492', // Green
} as const;

/**
 * Get panel data pane colors with proper structure for components
 */
export function usePanelDataPaneColors() {
  return {
    query: { accent: PANEL_DATA_PANE_COLORS.query },
    expression: { accent: PANEL_DATA_PANE_COLORS.expression },
    transform: { accent: PANEL_DATA_PANE_COLORS.transform },
  };
}
