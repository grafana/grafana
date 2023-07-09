import { AppEvents, NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  getUrlSyncManager,
  sceneGraph,
  SceneGridItem,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectStateChangedEvent,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  VizPanel,
} from '@grafana/scenes';
import appEvents from 'app/core/app_events';

import { DashboardSceneRenderer } from './DashboardSceneRenderer';

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
  private _pageNavCache?: NavModelItem;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['inspect', 'viewPanel'] });

  constructor(state: DashboardSceneState) {
    super(state);

    this.addActivationHandler(() => {
      return () => {
        getUrlSyncManager().cleanUp(this);
      };
    });

    this.subscribeToEvent(SceneObjectStateChangedEvent, this.onChildStateChanged);
  }

  getUrlState() {
    return { inspect: this.state.inspectPanelKey, viewPanel: this.state.viewPanelKey };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const update: Partial<DashboardSceneState> = {};

    // Handle inspect object state
    if (typeof values.inspect === 'string') {
      const panel = this.findPanel(values.inspect);
      if (!panel) {
        appEvents.emit(AppEvents.alertError, ['Panel not found']);
        locationService.partial({ inspect: null });
        return;
      }

      update.inspectPanelKey = values.inspect;
    } else if (this.state.inspectPanelKey) {
      update.inspectPanelKey = undefined;
    }

    // Handle view panel state
    if (typeof values.viewPanel === 'string') {
      const panel = this.findPanel(values.viewPanel);
      if (!panel) {
        appEvents.emit(AppEvents.alertError, ['Panel not found']);
        locationService.partial({ viewPanel: null });
        return;
      }

      update.viewPanelKey = values.viewPanel;
    } else if (this.state.viewPanelKey) {
      update.viewPanelKey = undefined;
    }

    if (Object.keys(update).length > 0) {
      this.setState(update);
    }
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
  };

  onDiscard = () => {
    // TODO open confirm modal if dirty
    // TODO actually discard changes
    this.setState({ isEditing: false });
  };

  onCloseInspectDrawer = () => {
    locationService.partial({ inspect: null });
  };

  getPageNav() {
    if (!this._pageNavCache) {
      this._pageNavCache = { text: this.state.title };
    }

    return this._pageNavCache;
  }
}
