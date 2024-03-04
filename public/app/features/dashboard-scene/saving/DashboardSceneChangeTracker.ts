import { Unsubscribable } from 'rxjs';

import {
  SceneDataLayers,
  SceneGridItem,
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
        this.detectChanges();
      }
    }
    if (payload.changedObject instanceof behaviors.CursorSync) {
      this.detectChanges();
    }
    if (payload.changedObject instanceof SceneDataLayers) {
      this.detectChanges();
    }
    if (payload.changedObject instanceof SceneGridItem) {
      this.detectChanges();
    }
    if (payload.changedObject instanceof SceneGridLayout) {
      this.detectChanges();
    }
    if (payload.changedObject instanceof DashboardScene) {
      if (Object.keys(payload.partialUpdate).some((key) => PERSISTED_PROPS.includes(key))) {
        this.detectChanges();
      }
    }
    if (payload.changedObject instanceof SceneTimeRange) {
      this.detectChanges();
    }
    if (payload.changedObject instanceof DashboardControls) {
      if (Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'hideTimeControls')) {
        this.detectChanges();
      }
    }
    if (payload.changedObject instanceof SceneVariableSet) {
      this.detectChanges();
    }
    if (payload.changedObject instanceof DashboardAnnotationsDataLayer) {
      if (!Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'data')) {
        this.detectChanges();
      }
    }
    if (isSceneVariableInstance(payload.changedObject)) {
      this.detectChanges();
    }
  }

  private detectChanges() {
    this._changesWorker?.postMessage({
      changed: transformSceneToSaveModel(this._dashboard),
      initial: this._dashboard.getInitialSaveModel(),
    });
  }

  private updateIsDirty(result: DashboardChangeInfo) {
    const { hasChanges } = result;

    if (hasChanges) {
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
