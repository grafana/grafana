import { type VizPanel, type SceneObject, type SceneObjectState } from '@grafana/scenes';
import { type DashboardLink } from '@grafana/schema';
import { type ScopeMeta } from 'app/features/dashboard/state/DashboardModel';
import { type DashboardMeta } from 'app/types/dashboard';

import { type PanelEditor } from '../../panel-edit/PanelEditor';
import { type DashboardEditView } from '../../settings/utils';
import { type DashboardSidebarLike } from '../../sidebar/types';
import { type DashboardControls } from '../DashboardControls';
import { type DashboardLayoutOrchestrator } from '../DashboardLayoutOrchestrator';

import { type AnyDashboardLayoutManager, type DashboardLayoutManager } from './DashboardLayoutManager';
import { type LayoutParent } from './LayoutParent';

export interface DashboardSceneState extends SceneObjectState {
  /** Dashboard-specific preferences **/
  preferences?: DashboardScenePreferences;

  /** The title */
  title: string;
  /** The description */
  description?: string;
  /** Tags */
  tags?: string[];
  /** Links */
  links: DashboardLink[];
  /** Is editable */
  editable?: boolean;
  /** Allows disabling grid lazy loading */
  preload?: boolean;
  /** A uid when saved */
  uid?: string;
  /** @experimental */
  scopeMeta?: ScopeMeta;
  /**
   * Layout of panels. Any kind, because a sibling resource's layout manager (the notebook) also
   * rides this scene and serializes its own kind rather than a dashboard layout kind.
   */
  body: AnyDashboardLayoutManager;
  /** NavToolbar actions */
  actions?: SceneObject[];
  /** Fixed row at the top of the canvas with for example variables and time range controls */
  controls?: DashboardControls;
  /** True when editing */
  isEditing?: boolean;
  /** True when user made a change */
  isDirty?: boolean;
  /** meta flags */
  meta: Omit<DashboardMeta, 'isNew'>;
  /** Version of the dashboard */
  version?: number;
  /** Panel to inspect */
  inspectPanelKey?: string;
  /** Panel key to view in fullscreen */
  viewPanel?: string;
  /** Edit view */
  editview?: DashboardEditView;
  /** Edit panel */
  editPanel?: PanelEditor;
  /** Scene object that handles the current drawer or modal */
  overlay?: SceneObject;
  /** Share view */
  shareView?: string;
  /** Renders panels in grid and filtered */
  panelSearch?: string;
  /** How many panels to show per row for search results */
  panelsPerRow?: number;
  /** options pane */
  sidebar: DashboardSidebarLike;
  /** Manages dragging/dropping of layout items */
  layoutOrchestrator: DashboardLayoutOrchestrator;
  /** True while default variables from datasources are being loaded */
  defaultVariablesLoading?: boolean;
  /** True while default links from datasources are being loaded */
  defaultLinksLoading?: boolean;
  /**
   * Set while an unbuilt dashboard plan is being previewed on this scene. The plan's panels are
   * scaffolded as real but query-less panels so the user can judge the layout before committing to
   * a build. Presence of this state is what puts the scene into planning mode: the toolbar shows the
   * plan's banner instead of save/settings/sharing, dashboard controls are hidden, and panels added
   * by hand stay query-less.
   */
  planning?: DashboardPlanningState;
}

export interface DashboardPlanningState {
  /** Title of the plan being previewed, shown in the banner. */
  planTitle: string;
  /** How many panels the plan proposes, shown in the banner. */
  panelCount: number;
  /** Build the plan: attach real queries to the scaffolded panels. */
  onBuild: () => void;
  /** Discard the plan and remove its scaffolded panels. */
  onDismiss: () => void;
  /**
   * A placeholder's visualization was changed by hand.
   *
   * Placeholder data is shaped for the visualization it was drawn for — a single value for a stat,
   * a series for a time series, categories for a pie — so whoever supplied that data needs to know
   * in order to re-shape it. Core does not know where the data came from, hence the callback.
   */
  onPanelVisualizationChanged?: (panelKey: string, pluginId: string) => void;
}

interface DashboardScenePreferences {
  defaultLayoutTemplate?: DashboardLayoutManager;
}

export interface DashboardSceneLike extends SceneObject<DashboardSceneState>, LayoutParent {
  isDashboardScene: boolean;

  copyPanel(vizPanel: VizPanel): void;

  getDefaultLayout(): DashboardLayoutManager | undefined;
}

function isDashboardSceneLike(obj: SceneObject): obj is DashboardSceneLike {
  return 'isDashboardScene' in obj;
}

export function getDashboardSceneLike(sceneObject: SceneObject): DashboardSceneLike {
  const root = sceneObject.getRoot();

  if (isDashboardSceneLike(root)) {
    return root;
  }

  throw new Error('SceneObject root is not a DashboardSceneLike object');
}
