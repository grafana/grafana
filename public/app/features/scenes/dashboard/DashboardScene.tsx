import * as H from 'history';

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
  inspectPanel?: VizPanel;
}

export class DashboardScene extends SceneObjectBase<DashboardSceneState> {
  static Component = DashboardSceneRenderer;
  private locationListenerUnsub?: () => void;
  private _pageNavCache?: NavModelItem;

  constructor(state: DashboardSceneState) {
    super(state);

    this.addActivationHandler(() => {
      this.locationListenerUnsub = locationService.getHistory().listen(this.onLocationUpdated);

      return () => {
        this.locationListenerUnsub!();
        getUrlSyncManager().cleanUp(this);
      };
    });

    this.subscribeToEvent(SceneObjectStateChangedEvent, this.onChildStateChanged);
  }

  // Handle query param updates
  onLocationUpdated = (location: H.Location) => {
    const queryParams = new URLSearchParams(location.search);
    const inspect = queryParams.get('inspect');

    // Inspect panel state
    if (inspect) {
      const panel = this.findPanel(inspect);
      if (panel) {
        this.setState({ inspectPanel: panel });
      } else {
        locationService.partial({ inspect: null });
        appEvents.emit(AppEvents.alertError, ['Panel not found']);
      }
    } else if (this.state.inspectPanel) {
      this.setState({ inspectPanel: undefined });
    }
  };

  findPanel(key: string): VizPanel | null {
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
