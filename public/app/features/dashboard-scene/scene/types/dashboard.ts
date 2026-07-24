import { type VizPanel, type SceneObject, type SceneObjectState } from '@grafana/scenes';
import { type DashboardLink } from '@grafana/schema';
import { type ScopeMeta } from 'app/features/dashboard/state/DashboardModel';
import { type DashboardMeta } from 'app/types/dashboard';

import { type DashboardEditPaneLike } from '../../edit-pane/types';
import { type PanelEditor } from '../../panel-edit/PanelEditor';
import { type DashboardEditView } from '../../settings/utils';
import { type DashboardControls } from '../DashboardControls';
import { type DashboardLayoutOrchestrator } from '../DashboardLayoutOrchestrator';

import { type DashboardLayoutManager } from './DashboardLayoutManager';
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
  /** Layout of panels */
  body: DashboardLayoutManager;
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
  editPane: DashboardEditPaneLike;
  /** Manages dragging/dropping of layout items */
  layoutOrchestrator: DashboardLayoutOrchestrator;
  /** True while default variables from datasources are being loaded */
  defaultVariablesLoading?: boolean;
  /** True while default links from datasources are being loaded */
  defaultLinksLoading?: boolean;
}

interface DashboardScenePreferences {
  defaultLayoutTemplate?: DashboardLayoutManager;
}

export interface DashboardSceneLike extends SceneObject<DashboardSceneState>, LayoutParent {
  isDashboardScene: boolean;

  copyPanel(vizPanel: VizPanel): void;
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
