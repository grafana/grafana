import { Location } from 'history';
import { Unsubscribable } from 'rxjs';

import { locationService } from '@grafana/runtime';

import { SceneObjectStateChangedEvent } from '../core/events';
import { SceneObject } from '../core/types';
import { forEachSceneObjectInState } from '../core/utils';

export class UrlSyncManager {
  private locationListenerUnsub: () => void;
  private stateChangeSub: Unsubscribable;
  private initialStates: Map<string, string> = new Map();

  public constructor(private sceneRoot: SceneObject) {
    this.stateChangeSub = sceneRoot.subscribeToEvent(SceneObjectStateChangedEvent, this.onStateChanged);
    this.locationListenerUnsub = locationService.getHistory().listen(this.onLocationUpdate);
  }

  private onLocationUpdate = (location: Location) => {
    const urlParams = new URLSearchParams(location.search);
    this.syncSceneStateFromUrl(this.sceneRoot, urlParams);
  };

  private onStateChanged = ({ payload }: SceneObjectStateChangedEvent) => {
    const changedObject = payload.changedObject;

    if (changedObject.urlSync) {
      const newUrlState = changedObject.urlSync.getUrlState(payload.newState);
      const prevUrlState = changedObject.urlSync.getUrlState(payload.prevState);

      const searchParams = locationService.getSearch();
      const mappedUpdated: Record<string, string> = {};

      for (const [key, newUrlValue] of newUrlState) {
        const currentUrlValue = searchParams.get(key);
        const uniqueKey = this.getUniqueKey(key, changedObject);

        if (currentUrlValue !== newUrlValue) {
          mappedUpdated[uniqueKey] = newUrlValue;

          // Remember the initial state so we can go back to it
          if (!this.initialStates.has(uniqueKey) && prevUrlState.has(key)) {
            this.initialStates.set(uniqueKey, prevUrlState.get(key)!);
          }
        }
      }

      if (Object.keys(mappedUpdated).length > 0) {
        locationService.partial(mappedUpdated, false);
      }
    }
  };

  private getUniqueKey(key: string, changedObject: SceneObject) {
    return key;
  }

  public cleanUp() {
    this.stateChangeSub.unsubscribe();
    this.locationListenerUnsub();
  }

  private syncSceneStateFromUrl(sceneObject: SceneObject, urlParams: URLSearchParams) {
    if (sceneObject.urlSync) {
      const urlState = new Map<string, string>();
      const currentState = sceneObject.urlSync.getUrlState(sceneObject.state);

      for (const key of sceneObject.urlSync.getKeys()) {
        const uniqueKey = this.getUniqueKey(key, sceneObject);
        const newValue = urlParams.get(uniqueKey);
        const currentValue = currentState.get(key);

        if (currentValue === newValue) {
          continue;
        }

        if (newValue !== null) {
          urlState.set(key, newValue);
          // Remember the initial state so we can go back to it
          if (!this.initialStates.has(uniqueKey) && currentValue !== undefined) {
            this.initialStates.set(uniqueKey, currentValue);
          }
        } else {
          const initialValue = this.initialStates.get(uniqueKey);
          if (initialValue !== undefined) {
            urlState.set(key, initialValue);
          }
        }
      }

      if (urlState.size > 0) {
        sceneObject.urlSync.updateFromUrl(urlState);
      }
    }

    forEachSceneObjectInState(sceneObject.state, (obj) => this.syncSceneStateFromUrl(obj, urlParams));
  }
}
