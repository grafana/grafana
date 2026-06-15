import { SceneObjectState, type SceneObject } from '@grafana/scenes';
import { ElementSelectionContextState, ElementSelectionOnSelectOptions } from '@grafana/ui';
import { DashboardEditActionEvent, DashboardEditActionEventPayload } from './events';
import { DashboardOutline } from './DashboardOutline';

export interface DashboardEditPaneState extends SceneObjectState {
  selectionContext: ElementSelectionContextState;

  undoStack: DashboardEditActionEventPayload[];
  redoStack: DashboardEditActionEventPayload[];
  outlinePane?: DashboardOutline;
  openPane?: DashboardSidebarPane;
  /** Temp hack for Link and LinkSet that are not part of the scene but need to be selected for now  */
  selectedDisconnectedObject?: SceneObject;
  /** Previous state */
  previousState?: DashboardEditPaneState;
  /** True when a new element is being added and selected */
  isNewElement: boolean;
  isDocked?: boolean;
}

/**
 * Subset of DashboardEditPane used by assistant view-mode components
 * so they can avoid importing the full DashboardEditPane (which would
 * create circular dependencies through DashboardScene).
 */
export interface DashboardEditPaneLike extends SceneObject<DashboardEditPaneState> {
  enableSelection(): void;
  disableSelection(): void;
  clearSelection(noEvent?: boolean): void;
  selectObject(obj: SceneObject, options?: ElementSelectionOnSelectOptions): void;
  openPane(openPane: DashboardSidebarPane): void;
  closePane(): void;
  getSelectedObject(key?: string): SceneObject | undefined;
  undoAction(): void;
  redoAction(): void;
  goBackToPrevious(): void;
  fixSelectionOfRemovedObject(): void;
  addNewPanel(target: SceneObject | undefined): void;
  pastePanel(target: SceneObject | undefined, source?: 'sidebar' | 'editPaneHeader'): void;
  setPanelEditAction(editAction: DashboardEditActionEvent): void;
}

export interface DashboardSidebarPane extends SceneObject {
  getId(): string;
  /** Some panes like code editor require a wider pane  */
  minWidth?: number;
  /** Exclude this pane from the go back history */
  excludeFromHistory?: boolean;
}
