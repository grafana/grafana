import { type SceneObject, type VizPanel } from '@grafana/scenes';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { type PanelIdGenerator } from '../../utils/dashboardSceneGraph';

import { type LayoutRegistryItem } from './LayoutRegistryItem';

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
  serialize(isSnapshot?: boolean): DashboardV2Spec['layout'];

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
   * Duplicate, like clone but with new keys.
   * @param panelIdGenerator Optional sequential ID generator shared across
   *   sibling layouts to prevent duplicate panel IDs.
   */
  duplicate(panelIdGenerator?: PanelIdGenerator): DashboardLayoutManager;

  /**
   * Paste a panel from the clipboard
   */
  pastePanel?(): void;

  /**
   * Get children for outline
   */
  getOutlineChildren(): SceneObject[];

  /**
   * Returns a list of all grid layout types contained within child tree
   */
  getAllGridTypes(): string[];

  /**
   * Whether the given multi-selection of this layout's direct children can be grouped into a new
   * row or tab. Only implemented by layout managers that can group the children they hold (rows,
   * tabs and grids); the shared grouping view dispatches through this instead of importing the
   * concrete grouping logic, which keeps the edit-pane out of the layout-manager import cycle.
   */
  canGroupSelectionInto?(items: SceneObject[], target: GroupTarget): GroupingResult;

  /**
   * Groups the given multi-selection of this layout's direct children into a new row or tab as a
   * single undo/redo entry. See {@link canGroupSelectionInto}.
   */
  groupSelectionInto?(items: SceneObject[], target: GroupTarget): void;
}

export function isDashboardLayoutManager(obj: SceneObject): obj is DashboardLayoutManager {
  return 'isDashboardLayoutManager' in obj;
}

export type GroupTarget = 'row' | 'tab';

export interface GroupingResult {
  enabled: boolean;
  reason?: string;
}

/**
 * A layout manager that knows how to group a multi-selection of its children. Used by the shared
 * grouping view to stay decoupled from the concrete grouping implementation (which must construct
 * concrete layout managers and therefore lives inside the layout-manager import cycle).
 */
export function isGroupableLayoutManager(
  manager: DashboardLayoutManager
): manager is DashboardLayoutManager &
  Required<Pick<DashboardLayoutManager, 'canGroupSelectionInto' | 'groupSelectionInto'>> {
  return typeof manager.canGroupSelectionInto === 'function' && typeof manager.groupSelectionInto === 'function';
}
