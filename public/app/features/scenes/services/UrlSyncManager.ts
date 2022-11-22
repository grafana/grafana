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
      const urlUpdate = changedObject.urlSync.getUrlState();
      const searchParams = locationService.getSearch();
      const mappedUpdated: Record<string, string> = {};

      urlUpdate.forEach((value, key) => {
        const currentValue = searchParams.get(key);
        if (currentValue !== value) {
          mappedUpdated[this.getMappedKey(key, changedObject)] = value;
        }
      });

      if (Object.keys(mappedUpdated).length > 0) {
        locationService.partial(mappedUpdated, true);
      }
    }
  };

  private getMappedKey(key: string, changedObject: SceneObject) {
    return key;
  }

  public cleanUp() {
    this.stateChangeSub.unsubscribe();
    this.locationListenerUnsub();
  }

  private syncSceneStateFromUrl(sceneObject: SceneObject, urlParams: URLSearchParams) {
    if (sceneObject.urlSync) {
      const urlState = new Map<string, string>();
      const currentState = sceneObject.urlSync.getUrlState();

      for (const key of sceneObject.urlSync.getKeys()) {
        const mappedKey = this.getMappedKey(key, sceneObject);
        const newValue = urlParams.get(mappedKey);
        const currentValue = currentState.get(key);

        if (currentValue === newValue) {
          continue;
        }

        if (newValue !== null) {
          urlState.set(key, newValue);
          // Remember the initial state so we can go back to it
          if (!this.initialStates.has(mappedKey)) {
            if (currentValue !== undefined) {
              this.initialStates.set(mappedKey, currentValue);
            }
          }
        } else {
          const initialValue = this.initialStates.get(mappedKey);
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
