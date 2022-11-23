import { Location } from 'history';
import { Unsubscribable } from 'rxjs';

import { locationService } from '@grafana/runtime';

import { SceneObjectStateChangedEvent } from '../core/events';
import { SceneObject } from '../core/types';

export class UrlSyncManager {
  private locationListenerUnsub: () => void;
  private stateChangeSub: Unsubscribable;

  public constructor(sceneRoot: SceneObject) {
    this.stateChangeSub = sceneRoot.subscribeToEvent(SceneObjectStateChangedEvent, this.onStateChanged);
    this.locationListenerUnsub = locationService.getHistory().listen(this.onLocationUpdate);
  }

  private onLocationUpdate = (location: Location) => {
    // TODO: find any scene object whose state we need to update
  };

  private onStateChanged = ({ payload }: SceneObjectStateChangedEvent) => {
    const changedObject = payload.changedObject;

    if ('getUrlState' in changedObject) {
      const urlUpdate = changedObject.getUrlState();
      locationService.partial(urlUpdate, true);
    }
  };

  public cleanUp() {
    this.stateChangeSub.unsubscribe();
    this.locationListenerUnsub();
  }
}
