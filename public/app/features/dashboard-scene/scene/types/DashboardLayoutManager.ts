import { type SceneObject, type VizPanel } from '@grafana/scenes';
import {
  type Element as DashboardElement,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { type PanelIdGenerator } from '../../utils/dashboardSceneGraph';

import { type LayoutRegistryItem } from './LayoutRegistryItem';

/**
 * A layout manager of any layout kind, whatever its serialize() returns. Needed where managers of
 * different kinds are held together: the notebook layout serializes a kind outside the dashboard
 * layout union, so it does not fit the plain DashboardLayoutManager.
 *
 * serialize() and getNonPanelElements() are not type-checked through this alias. Narrow to the
 * concrete manager first (e.g. `body instanceof NotebookLayoutManager`) if you need a specific kind.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- erases only the serialize()/element kinds so sibling layout managers fit
export type AnyDashboardLayoutManager = DashboardLayoutManager<{}, any, any>;

/**
 * A scene object that usually wraps an underlying layout
 * Dealing with all the state management and editing of the layout
 */
export interface DashboardLayoutManager<S = {}, TLayout = DashboardV2Spec['layout'], TElement = DashboardElement>
  extends SceneObject {
  /** Marks it as a DashboardLayoutManager */
  isDashboardLayoutManager: true;

  /**
   * The layout descriptor (which has the name and id)
   */
  descriptor: Readonly<LayoutRegistryItem>;

  /**
   * Serializer for layout. TLayout defaults to the dashboard layout union; sibling kinds
   * (e.g. the notebook layout) override it to return their own kind without a cast.
   */
  serialize(isSnapshot?: boolean): TLayout;

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
   * Elements this layout references that are NOT viz panels, keyed by element name.
   *
   * The v2 serializer derives the spec's `elements` map from {@link getVizPanels}, which is
   * complete for every dashboard layout. A sibling layout whose elements include non-panel
   * kinds — the notebook's markdown/code cells — must contribute them here, or they are
   * dropped on serialize while the layout keeps referencing them by name.
   *
   * TElement defaults to the dashboard element union; a sibling layout narrows it to its own
   * element kind (the notebook to `CellKind`) the same way it narrows TLayout.
   */
  getNonPanelElements?(): Record<string, TElement>;

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
  cloneLayout(ancestorKey: string, isSource: boolean): AnyDashboardLayoutManager;

  /**
   * Duplicate, like clone but with new keys.
   * @param panelIdGenerator Optional sequential ID generator shared across
   *   sibling layouts to prevent duplicate panel IDs.
   */
  duplicate(panelIdGenerator?: PanelIdGenerator): AnyDashboardLayoutManager;

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
}

export function isDashboardLayoutManager(obj: SceneObject): obj is DashboardLayoutManager {
  return 'isDashboardLayoutManager' in obj;
}
