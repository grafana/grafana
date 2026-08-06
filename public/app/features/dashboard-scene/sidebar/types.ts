import { type SceneObjectState, type SceneObject } from '@grafana/scenes';
import { type ElementSelectionContextState, type ElementSelectionOnSelectOptions } from '@grafana/ui';

import { type DashboardEditActionsHistory } from '../actions/DashboardEditActionsHistory';

import { type DashboardEditActionEvent } from './events';
import { type DashboardOutline } from './outline/DashboardOutline';

export interface DashboardSidebarState extends SceneObjectState {
  selectionContext: ElementSelectionContextState;

  editHistory: DashboardEditActionsHistory;
  outlinePane?: DashboardOutline;
  openPane?: DashboardSidebarPane;
  /** Temp hack for Link and LinkSet that are not part of the scene but need to be selected for now  */
  selectedDisconnectedObject?: SceneObject;
  /** Previous state */
  previousState?: DashboardSidebarState;
  /** True when a new element is being added and selected */
  isNewElement: boolean;
  isDocked?: boolean;
}

/**
 * Subset of DashboardSidebar used by assistant view-mode components
 * so they can avoid importing the full DashboardSidebar (which would
 * create circular dependencies through DashboardScene).
 */
export interface DashboardSidebarLike extends SceneObject<DashboardSidebarState> {
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
  pastePanel(target: SceneObject | undefined): void;
  setPanelEditAction(editAction: DashboardEditActionEvent): void;
}

export interface DashboardSidebarPane extends SceneObject {
  getId(): string;
  /** Some panes like code editor require a wider pane  */
  minWidth?: number;
  /** Exclude this pane from the go back history */
  excludeFromHistory?: boolean;
}

export enum SidebarCategoryType {
  TabSectionVariables = 'tab-section-variables',
  TabSectionVariablesList = 'tab-section-variables-list',
  RowSectionVariables = 'dash-row-section-variables',
  RowSectionVariablesList = 'dash-row-section-variables-list',
  DashboardVariables = 'dashboard-variables',

  TabSectionFilters = 'tab-section-filters',
  TabSectionFiltersList = 'tab-section-filters-list',
  RowSectionFilters = 'dash-row-section-filters',
  RowSectionFiltersList = 'dash-row-section-filters-list',
  DashboardFilters = 'dashboard-filters',

  DashboardLinks = 'dashboard-links',
  DashboardAnnotations = 'dashboard-annotations',
}
