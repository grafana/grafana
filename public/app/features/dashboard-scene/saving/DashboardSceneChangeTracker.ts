import { Unsubscribable } from 'rxjs';

import {
  SceneDataLayerSet,
  SceneGridLayout,
  SceneObjectStateChangedEvent,
  SceneRefreshPicker,
  SceneTimeRange,
  SceneVariableSet,
  behaviors,
} from '@grafana/scenes';
import { createWorker } from 'app/features/dashboard-scene/saving/createDetectChangesWorker';

import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardGridItem } from '../scene/DashboardGridItem';
import { DashboardScene, PERSISTED_PROPS } from '../scene/DashboardScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { isSceneVariableInstance } from '../settings/variables/utils';

import { DashboardChangeInfo } from './shared';

export class DashboardSceneChangeTracker {
  private _changeTrackerSub: Unsubscribable | undefined;
  private _changesWorker?: Worker;
  private _dashboard: DashboardScene;

  constructor(dashboard: DashboardScene) {
    this._dashboard = dashboard;
  }

  private onStateChanged({ payload }: SceneObjectStateChangedEvent) {
    if (payload.changedObject instanceof SceneRefreshPicker) {
      if (Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'intervals')) {
        this.detectSaveModelChanges();
      }
    }
    if (payload.changedObject instanceof behaviors.CursorSync) {
      this.detectSaveModelChanges();
    }
    if (payload.changedObject instanceof SceneDataLayerSet) {
      this.detectSaveModelChanges();
    }
    if (payload.changedObject instanceof DashboardGridItem) {
      this.detectSaveModelChanges();
    }
    if (payload.changedObject instanceof SceneGridLayout) {
      this.detectSaveModelChanges();
    }
    if (payload.changedObject instanceof DashboardScene) {
      if (Object.keys(payload.partialUpdate).some((key) => PERSISTED_PROPS.includes(key))) {
        this.detectSaveModelChanges();
      }
    }
    if (payload.changedObject instanceof SceneTimeRange) {
      this.detectSaveModelChanges();
    }
    if (payload.changedObject instanceof DashboardControls) {
      if (Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'hideTimeControls')) {
        this.detectSaveModelChanges();
      }
    }
    if (payload.changedObject instanceof SceneVariableSet) {
      this.detectSaveModelChanges();
    }
    if (payload.changedObject instanceof DashboardAnnotationsDataLayer) {
      if (!Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'data')) {
        this.detectSaveModelChanges();
      }
    }
    if (isSceneVariableInstance(payload.changedObject)) {
      this.detectSaveModelChanges();
    }
  }

  private detectSaveModelChanges() {
    this._changesWorker?.postMessage({
      changed: transformSceneToSaveModel(this._dashboard),
      initial: this._dashboard.getInitialSaveModel(),
    });
  }

  private hasMetadataChanges() {
    return this._dashboard.state.meta.folderUid !== this._dashboard.getInitialState()?.meta.folderUid;
  }

  private updateIsDirty(result: DashboardChangeInfo) {
    const { hasChanges } = result;

    if (hasChanges || this.hasMetadataChanges()) {
      if (!this._dashboard.state.isDirty) {
        this._dashboard.setState({ isDirty: true });
      }
    } else {
      if (this._dashboard.state.isDirty) {
        this._dashboard.setState({ isDirty: false });
      }
    }
  }

  private init() {
    this._changesWorker = createWorker();
  }

  public startTrackingChanges() {
    if (!this._changesWorker) {
      this.init();
    }
    this._changesWorker!.onmessage = (e: MessageEvent<DashboardChangeInfo>) => {
      this.updateIsDirty(e.data);
    };

    this._changeTrackerSub = this._dashboard.subscribeToEvent(
      SceneObjectStateChangedEvent,
      this.onStateChanged.bind(this)
    );
  }

  public stopTrackingChanges() {
    this._changeTrackerSub?.unsubscribe();
  }

  public terminate() {
    this.stopTrackingChanges();
    this._changesWorker?.terminate();
  }
}
