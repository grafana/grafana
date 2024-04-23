import { Subscription } from 'rxjs';

import { SceneGridLayout, SceneObjectStateChangedEvent, VizPanel } from '@grafana/scenes';
import { createWorker } from 'app/features/dashboard-scene/saving/createDetectChangesWorker';

import { DashboardGridItem } from '../scene/DashboardGridItem';
import { DashboardScene } from '../scene/DashboardScene';
import { VizPanelLinks } from '../scene/PanelLinks';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { isSceneVariableInstance } from '../settings/variables/utils';

import { PersistedStateChangedEvent } from './PersistedStateChangedEvent';
import { DashboardChangeInfo } from './shared';

export class DashboardSceneChangeTracker {
  private _subs: Subscription | undefined;
  private _changesWorker?: Worker;
  private _dashboard: DashboardScene;

  constructor(dashboard: DashboardScene) {
    this._dashboard = dashboard;
  }

  private onStateChanged({ payload }: SceneObjectStateChangedEvent) {
    // If there are no changes in the state, the check is not needed
    if (Object.keys(payload.partialUpdate).length === 0) {
      return;
    }

    // if (payload.changedObject instanceof SceneQueryRunner) {
    //   return;
    // }

    // if (payload.changedObject instanceof SceneTimeRange) {
    //   return this.runDirtyCheck();
    // }

    // Intercept state changes for some core scene objects
    if (
      payload.changedObject instanceof VizPanel ||
      payload.changedObject instanceof DashboardGridItem ||
      payload.changedObject instanceof VizPanelLinks
    ) {
      return this.runDirtyCheck();
    }

    if (payload.changedObject instanceof SceneGridLayout) {
      return this.runDirtyCheck();
    }

    if (isSceneVariableInstance(payload.changedObject)) {
      return this.runDirtyCheck();
    }
  }

  private onPersistedStateChanged() {
    this.runDirtyCheck();
  }

  public runDirtyCheck() {
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

    this._subs = new Subscription();
    this._subs?.add(this._dashboard.subscribeToEvent(SceneObjectStateChangedEvent, this.onStateChanged.bind(this)));

    this._subs?.add(
      this._dashboard.subscribeToEvent(PersistedStateChangedEvent, this.onPersistedStateChanged.bind(this))
    );
  }

  public stopTrackingChanges() {
    this._subs?.unsubscribe();
  }

  public terminate() {
    this.stopTrackingChanges();
    this._changesWorker?.terminate();
  }
}
