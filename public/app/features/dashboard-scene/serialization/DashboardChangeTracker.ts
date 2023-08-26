import { Unsubscribable } from 'rxjs';

import { UrlQueryMap } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneGridItem, SceneObjectStateChangedEvent } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';

import { getDashboardLoader } from './DashboardsLoader';

export class DashboardChangeTracker {
  private _sub?: Unsubscribable;
  private _scene: DashboardScene;
  private _original?: DashboardScene;
  private _orignalUrlState?: UrlQueryMap;

  constructor(scene: DashboardScene) {
    this._scene = scene;
  }

  saveOriginal() {
    this._original = this._scene.clone();
    this._orignalUrlState = locationService.getSearchObject();
  }

  startTracking() {
    this._sub = this._scene.subscribeToEvent(SceneObjectStateChangedEvent, (event: SceneObjectStateChangedEvent) => {
      if (event.payload.changedObject instanceof SceneGridItem) {
        this._scene.setState({ isDirty: true });
      }
    });
  }

  discard() {
    this._sub?.unsubscribe();
    getDashboardLoader().revertTo(this._original!, this._orignalUrlState!);
  }
}
