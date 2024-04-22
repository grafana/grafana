import { Unsubscribable } from 'rxjs';

import { SceneObjectStateChangedEvent } from '@grafana/scenes';
import { createWorker } from 'app/features/dashboard-scene/saving/createDetectChangesWorker';

import { DashboardScene } from '../scene/DashboardScene';
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
    // If there are no changes in the state, the check is not needed
    if (Object.keys(payload.partialUpdate).length === 0) {
      return;
    }

    if (payload.changedObject.shouldCheckForChanges(payload.partialUpdate)) {
      return this.detectSaveModelChanges();
    }

    if (isSceneVariableInstance(payload.changedObject)) {
      return this.detectSaveModelChanges();
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
