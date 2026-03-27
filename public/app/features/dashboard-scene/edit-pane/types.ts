/**
 * Subset of DashboardEditPane used by assistant view-mode components
 * so they can avoid importing the full DashboardEditPane (which would
 * create circular dependencies through DashboardScene).
 */
export interface EditPaneSelectionActions {
  enableSelection(): void;
  disableSelection(): void;
  clearSelection(noEvent?: boolean): void;
}
