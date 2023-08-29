import * as H from 'history';
import { Unsubscribable } from 'rxjs';

import { locationUtil, NavModelItem, UrlQueryMap } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  getUrlSyncManager,
  SceneGridItem,
  SceneGridLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectStateChangedEvent,
  sceneUtils,
} from '@grafana/scenes';

import { DashboardSceneRenderer } from '../scene/DashboardSceneRenderer';
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

  /**
   * Handles url sync
   */
  protected _urlSync = new DashboardSceneUrlSync(this);
  /**
   * State before editing started
   */
  private _initialState?: DashboardSceneState;
  /**
   * Url state before editing started
   */
  private _initiallUrlState?: UrlQueryMap;
  /**
   * change tracking subscription
   */
  private _changeTrackerSub?: Unsubscribable;

  constructor(state: DashboardSceneState) {
    super(state);

    this.addActivationHandler(() => this.onActivate());
  }

  private onActivate() {
    if (this.state.isEditing) {
      this.startTrackingChanges();
    }

    // Deactivation logic
    return () => {
      this.stopTrackingChanges();
      this.stopUrlSync();
    };
  }

  startUrlSync() {
    getUrlSyncManager().initSync(this);
  }

  stopUrlSync() {
    getUrlSyncManager().cleanUp(this);
  }

  onEnterEditMode = () => {
    // Save this state
    this._initialState = sceneUtils.cloneSceneObjectState(this.state);
    this._initiallUrlState = locationService.getSearchObject();

    // Switch to edit mode
    this.setState({ isEditing: true });

    // Propagate change edit mode change to children
    if (this.state.body instanceof SceneGridLayout) {
      this.state.body.setState({ isDraggable: true, isResizable: true });
      forceRenderChildren(this.state.body, true);
    }

    this.startTrackingChanges();
  };

  onDiscard = () => {
    // No need to listen to changes anymore
    this.stopTrackingChanges();
    // Stop url sync before updating url
    this.stopUrlSync();
    // Now we can update url
    locationService.partial(this._initiallUrlState!, true);
    // Update state and disable editing
    this.setState({ ...this._initialState, isEditing: false });
    // and start url sync again
    this.startUrlSync();

    // Disable grid dragging
    if (this.state.body instanceof SceneGridLayout) {
      this.state.body.setState({ isDraggable: false, isResizable: false });
      forceRenderChildren(this.state.body, true);
    }
  };

  onSave = () => {
    this.setState({ drawer: new SaveDashboardDrawer(this) });
  };

  getPageNav(location: H.Location) {
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
  getBodyToRender(viewPanelKey?: string): SceneObject {
    const viewPanel = findVizPanel(this, viewPanelKey);
    return viewPanel ?? this.state.body;
  }

  private startTrackingChanges() {
    this._changeTrackerSub = this.subscribeToEvent(
      SceneObjectStateChangedEvent,
      (event: SceneObjectStateChangedEvent) => {
        if (event.payload.changedObject instanceof SceneGridItem) {
          this.setState({ isDirty: true });
        }
      }
    );
  }

  private stopTrackingChanges() {
    this._changeTrackerSub?.unsubscribe();
  }

  getInitialState(): DashboardSceneState | undefined {
    return this._initialState;
  }
}
