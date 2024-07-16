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

  static isUpdatingPersistedState({ payload }: SceneObjectStateChangedEvent) {
    // If there are no changes in the state, the check is not needed
    if (Object.keys(payload.partialUpdate).length === 0) {
      return false;
    }

    // Any change in the panel should trigger a change detection
    // The VizPanelManager includes configuration for the panel like repeat
    // The PanelTimeRange includes the overrides configuration
    if (
      payload.changedObject instanceof VizPanel ||
      payload.changedObject instanceof DashboardGridItem ||
      payload.changedObject instanceof PanelTimeRange
    ) {
      return true;
    }
    // VizPanelManager includes the repeat configuration
    if (payload.changedObject instanceof VizPanelManager) {
      console.log(payload);

      if (
        Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'repeat') ||
        Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'repeatDirection') ||
        Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'maxPerRow')
      ) {
        return true;
      }
    }
    // SceneQueryRunner includes the DS configuration
    if (payload.changedObject instanceof SceneQueryRunner) {
      if (!Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'data')) {
        return true;
      }
    }
    // SceneDataTransformer includes the transformation configuration
    if (payload.changedObject instanceof SceneDataTransformer) {
      if (!Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'data')) {
        return true;
      }
    }
    if (payload.changedObject instanceof VizPanelLinks) {
      return true;
    }
    if (payload.changedObject instanceof SceneRefreshPicker) {
      if (
        Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'intervals') ||
        Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'refresh')
      ) {
        return true;
      }
    }
    if (payload.changedObject instanceof behaviors.CursorSync) {
      return true;
    }
    if (payload.changedObject instanceof SceneDataLayerSet) {
      return true;
    }
    if (payload.changedObject instanceof DashboardGridItem) {
      return true;
    }
    if (payload.changedObject instanceof SceneGridLayout) {
      return true;
    }
    if (payload.changedObject instanceof DashboardScene) {
      if (Object.keys(payload.partialUpdate).some((key) => PERSISTED_PROPS.includes(key))) {
        return true;
      }
    }
    if (payload.changedObject instanceof SceneTimeRange) {
      return true;
    }
    if (payload.changedObject instanceof DashboardControls) {
      if (Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'hideTimeControls')) {
        return true;
      }
    }
    if (payload.changedObject instanceof SceneVariableSet) {
      return true;
    }
    if (payload.changedObject instanceof DashboardAnnotationsDataLayer) {
      if (!Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'data')) {
        return true;
      }
    }
    if (payload.changedObject instanceof behaviors.LiveNowTimer) {
      return true;
    }
    if (isSceneVariableInstance(payload.changedObject)) {
      return true;
    }
    return false;
  }

  private onStateChanged(event: SceneObjectStateChangedEvent) {
    if (DashboardSceneChangeTracker.isUpdatingPersistedState(event)) {
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
    this._changesWorker = undefined;
  }
}
