import * as H from 'history';

import { AppEvents, locationUtil, NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  getUrlSyncManager,
  sceneGraph,
  SceneGridItem,
  SceneGridLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectStateChangedEvent,
  SceneObjectUrlSyncHandler,
  SceneObjectUrlValues,
  VizPanel,
} from '@grafana/scenes';
import appEvents from 'app/core/app_events';

import { DashboardSceneRenderer } from './DashboardSceneRenderer';
import { forceRenderChildren } from './utils';

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
}

export class DashboardScene extends SceneObjectBase<DashboardSceneState> {
  static Component = DashboardSceneRenderer;

  protected _urlSync = new DashboardSceneUrlSync(this);

  constructor(state: DashboardSceneState) {
    super(state);

    this.addActivationHandler(() => {
      return () => {
        getUrlSyncManager().cleanUp(this);
      };
    });

    this.subscribeToEvent(SceneObjectStateChangedEvent, this.onChildStateChanged);
  }

  findPanel(key: string | undefined): VizPanel | null {
    if (!key) {
      return null;
    }

    const obj = sceneGraph.findObject(this, (obj) => obj.state.key === key);
    if (obj instanceof VizPanel) {
      return obj;
    }

    return null;
  }

  onChildStateChanged = (event: SceneObjectStateChangedEvent) => {
    // Temporary hacky way to detect changes
    if (event.payload.changedObject instanceof SceneGridItem) {
      this.setState({ isDirty: true });
    }
  };

  initUrlSync() {
    getUrlSyncManager().initSync(this);
  }

  onEnterEditMode = () => {
    this.setState({ isEditing: true });

    // Make grid draggable
    if (this.state.body instanceof SceneGridLayout) {
      this.state.body.setState({ isDraggable: true, isResizable: true });
      forceRenderChildren(this.state.body, true);
    }
  };

  onDiscard = () => {
    // TODO open confirm modal if dirty
    // TODO actually discard changes
    this.setState({ isEditing: false });

    // Disable grid dragging
    if (this.state.body instanceof SceneGridLayout) {
      this.state.body.setState({ isDraggable: false, isResizable: false });
      forceRenderChildren(this.state.body, true);
    }
  };

  onCloseInspectDrawer = () => {
    locationService.partial({ inspect: null });
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
}

class DashboardSceneUrlSync implements SceneObjectUrlSyncHandler {
  constructor(private _scene: DashboardScene) {}

  getKeys(): string[] {
    return ['inspect', 'viewPanel'];
  }

  getUrlState(): SceneObjectUrlValues {
    const state = this._scene.state;
    return { inspect: state.inspectPanelKey, viewPanel: state.viewPanelKey };
  }

  updateFromUrl(values: SceneObjectUrlValues): void {
    const { inspectPanelKey, viewPanelKey } = this._scene.state;
    const update: Partial<DashboardSceneState> = {};

    // Handle inspect object state
    if (typeof values.inspect === 'string') {
      const panel = this._scene.findPanel(values.inspect);
      if (!panel) {
        appEvents.emit(AppEvents.alertError, ['Panel not found']);
        locationService.partial({ inspect: null });
        return;
      }

      update.inspectPanelKey = values.inspect;
    } else if (inspectPanelKey) {
      update.inspectPanelKey = undefined;
    }

    // Handle view panel state
    if (typeof values.viewPanel === 'string') {
      const panel = this._scene.findPanel(values.viewPanel);
      if (!panel) {
        appEvents.emit(AppEvents.alertError, ['Panel not found']);
        locationService.partial({ viewPanel: null });
        return;
      }

      update.viewPanelKey = values.viewPanel;
    } else if (viewPanelKey) {
      update.viewPanelKey = undefined;
    }

    if (Object.keys(update).length > 0) {
      this._scene.setState(update);
    }
  }
}
