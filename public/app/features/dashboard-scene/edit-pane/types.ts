import { type SceneObject } from '@grafana/scenes';

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

export type DashboardSidebarPaneName = 'element' | 'outline' | 'filters' | 'add' | 'code' | 'variable-type-selection';

export interface DashboardSidebarPane extends SceneObject {
  getId(): DashboardSidebarPaneName;
  /**
   * Some panes like code editor require a wider pane
   */
  minWidth?: number;
}
