import * as H from 'history';

import { locationUtil, NavModelItem } from '@grafana/data';
import { getUrlSyncManager, SceneGridLayout, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import { DashboardSceneRenderer } from '../scene/DashboardSceneRenderer';
import { DashboardChangeTracker } from '../serialization/DashboardChangeTracker';
import { SaveDashboardDrawer } from '../serialization/SaveDashboardDrawer';
import { findVizPanel } from '../utils/findVizPanel';
import { forceRenderChildren } from '../utils/utils';

import { DashboardSceneUrlSync } from './DashboardSceneUrlSync';

export interface DashboardSceneState extends SceneObjectState {
  title: string;
  uid?: string;
  body: SceneObject;
  actions?: SceneObject[];
  controls?: SceneObject[];
  isEditing?: boolean;
  isDirty?: boolean;
  /** Scene object key for object to inspect */
  inspectPanelKey?: string;
  /** Scene object key for object to view in fullscreen */
  viewPanelKey?: string;
  /** Scene object that handles the current drawer */
  drawer?: SceneObject;
}

export class DashboardScene extends SceneObjectBase<DashboardSceneState> {
  static Component = DashboardSceneRenderer;

  protected _urlSync = new DashboardSceneUrlSync(this);
  private _changeTracker?: DashboardChangeTracker;

  constructor(state: DashboardSceneState) {
    super(state);

    this.addActivationHandler(() => this.onActivate());
  }

  private onActivate() {
    if (this.state.isEditing) {
      this._changeTracker?.startTracking();
    }

    // Deactivation logic
    return () => {
      this._changeTracker?.stopTracking();
      this.stopUrlSync();
    };
  }

  public startUrlSync() {
    getUrlSyncManager().initSync(this);
  }

  public stopUrlSync() {
    getUrlSyncManager().cleanUp(this);
  }

  public onEnterEditMode = () => {
    this.setState({ isEditing: true });

    // Make grid draggable
    if (this.state.body instanceof SceneGridLayout) {
      this.state.body.setState({ isDraggable: true, isResizable: true });
      forceRenderChildren(this.state.body, true);
    }

    this._changeTracker = new DashboardChangeTracker(this);
    this._changeTracker.startTracking();
  };

  public onDiscard = () => {
    // TODO open confirm modal if dirty
    // TODO actually discard changes
    this.setState({ isEditing: false });

    // Disable grid dragging
    if (this.state.body instanceof SceneGridLayout) {
      this.state.body.setState({ isDraggable: false, isResizable: false });
      forceRenderChildren(this.state.body, true);
    }

    this._changeTracker?.discard();
  };

  public onSave = () => {
    this.setState({ drawer: new SaveDashboardDrawer(this, this._changeTracker!) });
  };

  public getPageNav(location: H.Location) {
    let pageNav: NavModelItem = {
      text: this.state.title,
      url: locationUtil.getUrlForPartial(location, { viewPanel: null, inspect: null }),
    };

    if (this.state.viewPanelKey) {
      pageNav = {
        text: 'View panel',
        parentItem: pageNav,
      };
    }

    return pageNav;
  }

  /**
   * Returns the body (layout) or the full view panel
   */
  public getBodyToRender(viewPanelKey?: string): SceneObject {
    const viewPanel = findVizPanel(this, viewPanelKey);
    return viewPanel ?? this.state.body;
  }
}
