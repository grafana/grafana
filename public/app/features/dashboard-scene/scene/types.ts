import { BusEventWithPayload, RegistryItem } from '@grafana/data';
import { SceneObject, VizPanel } from '@grafana/scenes';

/**
 * A scene object that usually wraps an underlying layout
 * Dealing with all the state management and editing of the layout
 */
export interface DashboardLayoutManager extends SceneObject {
  /**
   * Notify the layout manager that the edit mode has changed
   * @param isEditing
   */
  editModeChanged(isEditing: boolean): void;
  /**
   * We should be able to figure out how to add the explore panel in a way that leaves the
   * initialSaveModel clean from it so we can leverage the default discard changes logic.
   * Then we can get rid of this.
   */
  cleanUpStateFromExplore?(): void;
  /**
   * Not sure we will need this in the long run, we should be able to handle this inside internally
   */
  getNextPanelId(): number;
  /**
   * Remove an elemenet / panel
   * @param element
   */
  removePanel(panel: VizPanel): void;
  /**
   * Creates a copy of an existing element and adds it to the layout
   * @param element
   */
  duplicatePanel(panel: VizPanel): void;
  /**
   * Adds a new panel to the layout
   */
  addPanel(panel: VizPanel): void;
  /**
   * Add row
   */
  addNewRow(): void;
  /**
   * getVizPanels
   */
  getVizPanels(): VizPanel[];
  /**
   * Turn into a save model
   * @param saveModel
   */
  toSaveModel?(): any;
  /**
   * For dynamic panels that need to be viewed in isolation (SoloRoute)
   */
  activateRepeaters?(): void;
}

/**
 * The layout descriptor used when selecting / switching layouts
 */
export interface LayoutRegistryItem extends RegistryItem {
  /**
   * When switching between layouts
   * @param currentLayout
   */
  createFromLayout(currentLayout: DashboardLayoutManager): DashboardLayoutManager;
  /**
   * Create from persisted state
   * @param saveModel
   */
  createFromSaveModel?(saveModel: any): void;
}

export interface LayoutEditorProps<T> {
  layoutManager: T;
}

/**
 * This interface is needed to support layouts existing on different levels of the scene (DashboardScene and inside the TabsLayoutManager)
 */
export interface LayoutParent extends SceneObject {
  switchLayout(newLayout: DashboardLayoutManager): void;
}

export function isLayoutParent(obj: SceneObject): obj is LayoutParent {
  return 'switchLayout' in obj;
}

export interface DashboardRepeatsProcessedEventPayload {
  source: SceneObject;
}

export class DashboardRepeatsProcessedEvent extends BusEventWithPayload<DashboardRepeatsProcessedEventPayload> {
  public static type = 'dashboard-repeats-processed';
}
