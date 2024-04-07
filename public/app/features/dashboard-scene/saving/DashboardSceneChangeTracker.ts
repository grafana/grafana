import { Unsubscribable } from 'rxjs';

import {
  SceneDataLayerSet,
  SceneDataTransformer,
  SceneGridLayout,
  SceneObjectStateChangedEvent,
  SceneQueryRunner,
  SceneRefreshPicker,
  SceneTimeRange,
  SceneVariableSet,
  VizPanel,
  behaviors,
} from '@grafana/scenes';
import { createWorker } from 'app/features/dashboard-scene/saving/createDetectChangesWorker';

import { VizPanelManager } from '../panel-edit/VizPanelManager';
import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardGridItem } from '../scene/DashboardGridItem';
import { DashboardScene, PERSISTED_PROPS } from '../scene/DashboardScene';
import { VizPanelLinks } from '../scene/PanelLinks';
import { PanelTimeRange } from '../scene/PanelTimeRange';
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
    // If there are no changes in the sate, the check is not needed
    if (Object.keys(payload.partialUpdate).length === 0) {
      return;
    }

    // Any change in the panel should trigger a change detection
    // The VizPanelManager includes configuration for the panel like repeat
    // The PanelTimeRange includes the overrides configuration
    if (
      payload.changedObject instanceof VizPanel ||
      payload.changedObject instanceof DashboardGridItem ||
      payload.changedObject instanceof PanelTimeRange
    ) {
      return this.detectChanges();
    }
    // SceneQueryRunner includes the DS configuration
    if (payload.changedObject instanceof SceneQueryRunner) {
      if (!Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'data')) {
        return this.detectChanges();
      }
    }
    // SceneDataTransformer includes the transformation configuration
    if (payload.changedObject instanceof SceneDataTransformer) {
      if (!Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'data')) {
        return this.detectChanges();
      }
    }
    if (payload.changedObject instanceof VizPanelLinks) {
      return this.detectChanges();
    }
    if (payload.changedObject instanceof SceneRefreshPicker) {
      if (
        Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'intervals') ||
        Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'refresh')
      ) {
        return this.detectChanges();
      }
    }
    if (payload.changedObject instanceof behaviors.CursorSync) {
      return this.detectChanges();
    }
    if (payload.changedObject instanceof SceneDataLayerSet) {
      return this.detectChanges();
    }
    if (payload.changedObject instanceof DashboardGridItem) {
      return this.detectChanges();
    }
    if (payload.changedObject instanceof SceneGridLayout) {
      return this.detectChanges();
    }
    if (payload.changedObject instanceof DashboardScene) {
      if (Object.keys(payload.partialUpdate).some((key) => PERSISTED_PROPS.includes(key))) {
        return this.detectChanges();
      }
    }
    if (payload.changedObject instanceof SceneTimeRange) {
      return this.detectChanges();
    }
    if (payload.changedObject instanceof DashboardControls) {
      if (Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'hideTimeControls')) {
        return this.detectChanges();
      }
    }
    if (payload.changedObject instanceof SceneVariableSet) {
      return this.detectChanges();
    }
    if (payload.changedObject instanceof DashboardAnnotationsDataLayer) {
      if (!Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'data')) {
        return this.detectChanges();
      }
    }
    if (payload.changedObject instanceof behaviors.LiveNowTimer) {
      return this.detectChanges();
    }
    if (isSceneVariableInstance(payload.changedObject)) {
      return this.detectChanges();
    }
  }

  private detectChanges() {
    console.log('detectChanges');
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
