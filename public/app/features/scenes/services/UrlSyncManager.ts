import { Location } from 'history';
import { Unsubscribable } from 'rxjs';

import { locationService } from '@grafana/runtime';

import { SceneObjectStatePlainChangedEvent } from '../core/events';
import { isSceneObjectWithUrlSync, SceneObject } from '../core/types';

export class UrlSyncManager {
  private locationListenerUnsub: () => void;
  private stateChangeSub: Unsubscribable;

  constructor(sceneRoot: SceneObject) {
    this.stateChangeSub = sceneRoot.events.subscribe(SceneObjectStatePlainChangedEvent, this.onStateChanged);
    this.locationListenerUnsub = locationService.getHistory().listen(this.onLocationUpdate);
  }

  onLocationUpdate = (location: Location) => {
    // TODO: find any scene object whose state we need to update
  };

  onStateChanged = ({ payload }: SceneObjectStatePlainChangedEvent) => {
    const changedObject = payload.changedObject;
    if (!isSceneObjectWithUrlSync(changedObject)) {
      return;
    }

    const urlUpdate = changedObject.getUrlState();
    locationService.partial(urlUpdate, true);
  };

  cleanUp() {
    this.stateChangeSub.unsubscribe();
    this.locationListenerUnsub();
  }
}
