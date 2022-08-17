import { Location } from 'history';
import { Unsubscribable } from 'rxjs';

import { locationService } from '@grafana/runtime';

import { SceneObjectStateChangedEvent } from '../core/events';
import { SceneObject } from '../core/types';

export class UrlSyncManager {
  private locationListenerUnsub: () => void;
  private stateChangeSub: Unsubscribable;

  constructor(sceneRoot: SceneObject) {
    this.stateChangeSub = sceneRoot.events.subscribe(SceneObjectStateChangedEvent, this.onStateChanged);
    this.locationListenerUnsub = locationService.getHistory().listen(this.onLocationUpdate);
  }

  onLocationUpdate = (location: Location) => {
    // TODO: find any scene object whose state we need to update
  };

  onStateChanged = ({ payload }: SceneObjectStateChangedEvent) => {
    const changedObject = payload.changedObject;

    if ('getUrlState' in changedObject) {
      const urlUpdate = changedObject.getUrlState();
      locationService.partial(urlUpdate, true);
    }
  };

  cleanUp() {
    this.stateChangeSub.unsubscribe();
    this.locationListenerUnsub();
  }
}
