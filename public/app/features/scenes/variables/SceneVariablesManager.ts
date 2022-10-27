// import { Subscription, Unsubscribable } from 'rxjs';
// import { SceneObjectActivedEvent } from '../core/events';
// import { SceneObject } from '../core/types';

// export class SceneVariablesManager {
//   private subs: Subscription;

//   constructor(sceneRoot: SceneObject) {
//     this.subs.add(sceneRoot.events.subscribe(SceneObjectActivedEvent, this.onObjectActivated));
//   }

//   onObjectActivated = (event: SceneObjectActivedEvent) {

//   }

//   onLocationUpdate = (location: Location) => {
//     // TODO: find any scene object whose state we need to update
//   };

//   onStateChanged = ({ payload }: SceneObjectStateChangedEvent) => {
//     const changedObject = payload.changedObject;

//     if ('getUrlState' in changedObject) {
//       const urlUpdate = changedObject.getUrlState();
//       locationService.partial(urlUpdate, true);
//     }
//   };

//   cleanUp() {
//     this.stateChangeSub.unsubscribe();
//     this.locationListenerUnsub();
//   }
// }
