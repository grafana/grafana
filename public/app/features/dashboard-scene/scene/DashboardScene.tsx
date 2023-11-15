import * as H from 'history';
import { Unsubscribable } from 'rxjs';

import { CoreApp, DataQueryRequest, NavIndex, NavModelItem, UrlQueryMap } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
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
  SceneVariable,
  SceneVariableDependencyConfigLike,
} from '@grafana/scenes';
import appEvents from 'app/core/app_events';
import { getNavModel } from 'app/core/selectors/navModel';
import { newBrowseDashboardsEnabled } from 'app/features/browse-dashboards/featureFlag';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { VariablesChanged } from 'app/features/variables/types';
import { DashboardMeta } from 'app/types';

import { DashboardSceneRenderer } from '../scene/DashboardSceneRenderer';
import { SaveDashboardDrawer } from '../serialization/SaveDashboardDrawer';
import { DashboardModelCompatibilityWrapper } from '../utils/DashboardModelCompatibilityWrapper';
import { getDashboardUrl } from '../utils/urlBuilders';
import { findVizPanelByKey, forceRenderChildren, getClosestVizPanel, getPanelIdForVizPanel } from '../utils/utils';

import { DashboardSceneUrlSync } from './DashboardSceneUrlSync';
import { setupKeyboardShortcuts } from './keyboardShortcuts';

export interface DashboardSceneState extends SceneObjectState {
  /** The title */
  title: string;
  /** A uid when saved */
  uid?: string;
  /** @deprecated */
  id?: number | null;
  /** Layout of panels */
  body: SceneObject;
  /** NavToolbar actions */
  actions?: SceneObject[];
  /** Fixed row at the top of the canvas with for example variables and time range controls */
  controls?: SceneObject[];
  /** True when editing */
  isEditing?: boolean;
  /** True when user made a change */
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
   * Get notified when variables change
   */
  protected _variableDependency = new DashboardVariableDependency();

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
    window.__grafanaSceneContext = this;

    if (this.state.isEditing) {
      this.startTrackingChanges();
    }

    const clearKeyBindings = setupKeyboardShortcuts(this);
    const oldDashboardWrapper = new DashboardModelCompatibilityWrapper(this);

    // @ts-expect-error
    getDashboardSrv().setCurrent(oldDashboardWrapper);

    // Deactivation logic
    return () => {
      window.__grafanaSceneContext = undefined;
      clearKeyBindings();
      this.stopTrackingChanges();
      this.stopUrlSync();
      oldDashboardWrapper.destroy();
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

  public getPageNav(location: H.Location, navIndex: NavIndex) {
    const { meta } = this.state;

    let pageNav: NavModelItem = {
      text: this.state.title,
      url: getDashboardUrl({
        uid: this.state.uid,
        currentQueryParams: location.search,
        updateQuery: { viewPanel: null, inspect: null },
        useExperimentalURL: Boolean(config.featureToggles.dashboardSceneForViewers && meta.canEdit),
      }),
    };

    const { folderTitle, folderUid } = meta;

    if (folderUid) {
      if (newBrowseDashboardsEnabled()) {
        const folderNavModel = getNavModel(navIndex, `folder-dashboards-${folderUid}`).main;
        // If the folder hasn't loaded (maybe user doesn't have permission on it?) then
        // don't show the "page not found" breadcrumb
        if (folderNavModel.id !== 'not-found') {
          pageNav = {
            ...pageNav,
            parentItem: folderNavModel,
          };
        }
      } else {
        if (folderTitle) {
          pageNav = {
            ...pageNav,
            parentItem: {
              text: folderTitle,
              url: `/dashboards/f/${meta.folderUid}`,
            },
          };
        }
      }
    }

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

  public async onStarDashboard() {
    const { meta, uid } = this.state;
    if (!uid) {
      return;
    }
    try {
      const result = await getDashboardSrv().starDashboard(uid, Boolean(meta.isStarred));

      this.setState({
        meta: {
          ...meta,
          isStarred: result,
        },
      });
    } catch (err) {
      console.error('Failed to star dashboard', err);
    }
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

  canEditDashboard() {
    const { meta } = this.state;

    return Boolean(meta.canEdit || meta.canMakeEditable);
  }
}

export class DashboardVariableDependency implements SceneVariableDependencyConfigLike {
  private _emptySet = new Set<string>();

  getNames(): Set<string> {
    return this._emptySet;
  }

  public hasDependencyOn(): boolean {
    return false;
  }

  public variableUpdatesCompleted(changedVars: Set<SceneVariable>) {
    if (changedVars.size > 0) {
      // Temp solution for some core panels (like dashlist) to know that variables have changed
      appEvents.publish(new VariablesChanged({ refreshAll: true, panelIds: [] }));
    }
  }
}
