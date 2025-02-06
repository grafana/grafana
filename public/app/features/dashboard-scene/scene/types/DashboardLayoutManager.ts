import { SceneObject, VizPanel } from '@grafana/scenes';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { LayoutRegistryItem } from './LayoutRegistryItem';

/**
 * A scene object that usually wraps an underlying layout
 * Dealing with all the state management and editing of the layout
 */
export interface DashboardLayoutManager<S = {}> extends SceneObject {
  /** Marks it as a DashboardLayoutManager */
  isDashboardLayoutManager: true;

  /**
   * The layout descriptor (which has the name and id)
   */
  descriptor: Readonly<LayoutRegistryItem>;

  /**
   * Adds a new panel to the layout
   */
  addPanel(panel: VizPanel): void;

  /**
   * Remove an element / panel
   * @param panel
   */
  removePanel(panel: VizPanel): void;

  /**
   * Creates a copy of an existing element and adds it to the layout
   * @param panel
   */
  duplicatePanel(panel: VizPanel): void;

  /**
   * getVizPanels
   */
  getVizPanels(): VizPanel[];

  /**
   * Add row
   */
  addNewRow(): void;

  /**
   * Notify the layout manager that the edit mode has changed
   * @param isEditing
   */
  editModeChanged?(isEditing: boolean): void;

  /**
   * Turn into a save model
   */
  toSaveModel?(): S;

  /**
   * For dynamic panels that need to be viewed in isolation (SoloRoute)
   */
  activateRepeaters?(): void;

  /**
   * Renders options and layout actions
   */
  getOptions?(): OptionsPaneItemDescriptor[];

  /**
   * Create a clone of the layout manager given an ancestor key
   * @param ancestorKey
   * @param isSource
   */
  cloneLayout?(ancestorKey: string, isSource: boolean): DashboardLayoutManager;
}

export function isDashboardLayoutManager(obj: SceneObject): obj is DashboardLayoutManager {
  return 'isDashboardLayoutManager' in obj;
}
