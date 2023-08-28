import { Unsubscribable } from 'rxjs';

import { UrlQueryMap } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneGridItem, SceneObjectStateChangedEvent } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';

export class DashboardChangeTracker {
  private _sub?: Unsubscribable;
  private _scene: DashboardScene;
  private _original: DashboardScene;
  private _orignalUrlState: UrlQueryMap;

  constructor(scene: DashboardScene) {
    this._scene = scene;

    this._original = this._scene.clone();
    this._orignalUrlState = locationService.getSearchObject();
  }

  getOriginal(): DashboardScene {
    return this._original;
  }

  startTracking() {
    this._sub = this._scene.subscribeToEvent(SceneObjectStateChangedEvent, (event: SceneObjectStateChangedEvent) => {
      if (event.payload.changedObject instanceof SceneGridItem) {
        this._scene.setState({ isDirty: true });
      }
    });
  }

  stopTracking() {
    this._sub?.unsubscribe();
  }

  discard() {
    this._sub?.unsubscribe();
    // Stop url sync before updating url
    this._scene.stopUrlSync();
    // Now we can update url
    locationService.partial(this._orignalUrlState, true);
    // Update state and disable editing
    this._scene.setState({ ...this._original.state, isEditing: false });
    // and start url sync again
    this._scene.startUrlSync();
  }
}
