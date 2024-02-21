import { Unsubscribable } from 'rxjs';

import {
  SceneDataLayers,
  SceneGridItem,
  SceneObjectStateChangedEvent,
  SceneRefreshPicker,
  SceneTimeRange,
  SceneVariableSet,
  dataLayers,
} from '@grafana/scenes';
import { createWorker } from 'app/features/dashboard-scene/saving/workers/createDetectChangesWorker';

import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardScene, PERSISTED_PROPS } from '../scene/DashboardScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { isSceneVariableInstance } from '../settings/variables/utils';

import { DashboardChangeInfo } from './shared';

export class DashboardSceneChangeTracker {
  private _changeTrackerSub: Unsubscribable | undefined;
  private _changesWorker: Worker;
  private _scene: DashboardScene;

  constructor(scene: DashboardScene) {
    this._scene = scene;
    this._changesWorker = createWorker();
  }

  private detectChanges() {
    this._changesWorker?.postMessage({
      changed: transformSceneToSaveModel(this._scene),
      initial: this._scene.getInitialSaveModel(),
    });
  }

  private updateSceneStateAfterCheck(result: DashboardChangeInfo) {
    const { hasChanges } = result;

    if (hasChanges) {
      if (!this._scene.state.isDirty) {
        this._scene.setState({ isDirty: true });
      }
    } else {
      if (this._scene.state.isDirty) {
        this._scene.setState({ isDirty: false });
      }
    }
  }

  public startTrackingChanges() {
    this._changesWorker.onmessage = (e: MessageEvent<DashboardChangeInfo>) => {
      this.updateSceneStateAfterCheck(e.data);
    };

    this._changeTrackerSub = this._scene.subscribeToEvent(
      SceneObjectStateChangedEvent,
      (event: SceneObjectStateChangedEvent) => {
        if (event.payload.changedObject instanceof SceneRefreshPicker) {
          if (Object.prototype.hasOwnProperty.call(event.payload.partialUpdate, 'intervals')) {
            this.detectChanges();
          }
        }
        if (event.payload.changedObject instanceof SceneDataLayers) {
          this.detectChanges();
        }
        if (event.payload.changedObject instanceof dataLayers.AnnotationsDataLayer) {
          if (!Object.prototype.hasOwnProperty.call(event.payload.partialUpdate, 'data')) {
            this.detectChanges();
          }
        }
        if (event.payload.changedObject instanceof SceneGridItem) {
          this.detectChanges();
        }
        if (event.payload.changedObject instanceof DashboardScene) {
          if (Object.keys(event.payload.partialUpdate).some((key) => PERSISTED_PROPS.includes(key))) {
            this.detectChanges();
          }
        }
        if (event.payload.changedObject instanceof SceneTimeRange) {
          this.detectChanges();
        }
        if (event.payload.changedObject instanceof DashboardControls) {
          if (Object.prototype.hasOwnProperty.call(event.payload.partialUpdate, 'hideTimeControls')) {
            this.detectChanges();
          }
        }
        if (event.payload.changedObject instanceof SceneVariableSet) {
          this.detectChanges();
        }
        if (event.payload.changedObject instanceof DashboardAnnotationsDataLayer) {
          this.detectChanges();
        }
        if (isSceneVariableInstance(event.payload.changedObject)) {
          this.detectChanges();
        }
      }
    );
  }

  public stopTrackingChanges() {
    this._changesWorker.terminate();
    this._changeTrackerSub?.unsubscribe();
  }
}
