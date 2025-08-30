import { SceneObject, VizPanel } from '@grafana/scenes';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
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
   * Serializer for layout
   */
  serialize(): DashboardV2Spec['layout'];

  /**
   * Adds a new panel to the layout
   */
  addPanel(panel: VizPanel): void;

  /**
   * Remove an element / panel
   * @param panel
   */
  removePanel?(panel: VizPanel): void;

  /**
   * Creates a copy of an existing element and adds it to the layout
   * @param panel
   */
  duplicatePanel?(panel: VizPanel): void;

  /**
   * Gets all the viz panels in the layout
   */
  getVizPanels(): VizPanel[];

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
  cloneLayout(ancestorKey: string, isSource: boolean): DashboardLayoutManager;

  /**
   * Duplicate, like clone but with new keys
   */
  duplicate(): DashboardLayoutManager;

  /**
   * Paste a panel from the clipboard
   */
  pastePanel?(): void;

  /**
   * Get children for outline
   */
  getOutlineChildren(): SceneObject[];

  /**
   * Merge the layout with another layout
   */
  merge(other: DashboardLayoutManager): void;
}

export interface LayoutManagerSerializer {
  serialize(layout: DashboardLayoutManager, isSnapshot?: boolean): DashboardV2Spec['layout'];
  deserialize(
    layout: DashboardV2Spec['layout'],
    elements: DashboardV2Spec['elements'],
    preload: boolean
  ): DashboardLayoutManager;
}

export function isDashboardLayoutManager(obj: SceneObject): obj is DashboardLayoutManager {
  return 'isDashboardLayoutManager' in obj;
}
