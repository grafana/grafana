import * as H from 'history';
import { Unsubscribable } from 'rxjs';

import { CoreApp, DataQueryRequest, NavModelItem, UrlQueryMap } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  getUrlSyncManager,
  SceneFlexLayout,
  SceneGridItem,
  SceneGridLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectStateChangedEvent,
  sceneUtils,
} from '@grafana/scenes';
import { DashboardMeta } from 'app/types';

import { DashboardSceneRenderer } from '../scene/DashboardSceneRenderer';
import { SaveDashboardDrawer } from '../serialization/SaveDashboardDrawer';
import {
  findVizPanelByKey,
  forceRenderChildren,
  getClosestVizPanel,
  getDashboardUrl,
  getPanelIdForVizPanel,
} from '../utils/utils';

import { DashboardSceneUrlSync } from './DashboardSceneUrlSync';

export interface DashboardSceneState extends SceneObjectState {
  title: string;
  uid?: string;
  body: SceneObject;
  actions?: SceneObject[];
  controls?: SceneObject[];
  isEditing?: boolean;
  isDirty?: boolean;
  /** meta flags */
  meta: DashboardMeta;
  /** Panel to inspect */
  inspectPanelKey?: string;
  /** Panel to view in full screen */
  viewPanelKey?: string;
  /** Scene object that handles the current drawer or modal */
  overlay?: SceneObject;
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

  public constructor(state: Partial<DashboardSceneState>) {
    super({
      title: 'Dashboard',
      meta: {},
      body: state.body ?? new SceneFlexLayout({ children: [] }),
      ...state,
    });

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    if (this.state.isEditing) {
      this.startTrackingChanges();
    }

    // Deactivation logic
    return () => {
      this.stopTrackingChanges();
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

  public onDiscard = () => {
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

  public onSave = () => {
    this.setState({ overlay: new SaveDashboardDrawer({ dashboardRef: this.getRef() }) });
  };

  public getPageNav(location: H.Location) {
    let pageNav: NavModelItem = {
      text: this.state.title,
      url: getDashboardUrl({
        uid: this.state.uid,
        currentQueryParams: location.search,
        updateQuery: { viewPanel: null, inspect: null },
      }),
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
    const viewPanel = findVizPanelByKey(this, viewPanelKey);
    return viewPanel ?? this.state.body;
  }

  private startTrackingChanges() {
    this._changeTrackerSub = this.subscribeToEvent(
      SceneObjectStateChangedEvent,
      (event: SceneObjectStateChangedEvent) => {
        if (event.payload.changedObject instanceof SceneGridItem) {
          this.setIsDirty();
        }
      }
    );
  }

  private setIsDirty() {
    if (!this.state.isDirty) {
      this.setState({ isDirty: true });
    }
  }

  private stopTrackingChanges() {
    this._changeTrackerSub?.unsubscribe();
  }

  public getInitialState(): DashboardSceneState | undefined {
    return this._initialState;
  }

  public showModal(modal: SceneObject) {
    this.setState({ overlay: modal });
  }

  public closeModal() {
    this.setState({ overlay: undefined });
  }

  /**
   * Called by the SceneQueryRunner to privide contextural parameters (tracking) props for the request
   */
  public enrichDataRequest(sceneObject: SceneObject): Partial<DataQueryRequest> {
    const panel = getClosestVizPanel(sceneObject);

    return {
      app: CoreApp.Dashboard,
      dashboardUID: this.state.uid,
      panelId: (panel && getPanelIdForVizPanel(panel)) ?? 0,
    };
  }
}
