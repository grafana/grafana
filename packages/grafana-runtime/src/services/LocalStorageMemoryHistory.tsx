import * as H from 'history';
import { pick } from 'lodash';
import { BehaviorSubject, Observable } from 'rxjs';

type LocalStorageHistoryOptions = {
  storageKey: string;
};

interface LocationStorageHistory extends H.MemoryHistory {
  getLocationObservable(): Observable<H.Location | undefined>;
}

/**
 * Simple wrapper over the memory history that persists the location in the localStorage.
 *
 * @param options
 */
export function createLocationStorageHistory(options: LocalStorageHistoryOptions): LocationStorageHistory {
  const storedLocation = localStorage.getItem(options.storageKey);
  const initialEntry = storedLocation ? JSON.parse(storedLocation) : '/';
  const locationSubject = new BehaviorSubject<H.Location | undefined>(initialEntry);
  const memoryHistory = H.createMemoryHistory({ initialEntries: [initialEntry] });

  let currentLocation = memoryHistory.location;

  function maybeUpdateLocation() {
    if (memoryHistory.location !== currentLocation) {
      localStorage.setItem(
        options.storageKey,
        JSON.stringify(pick(memoryHistory.location, 'pathname', 'search', 'hash'))
      );
      currentLocation = memoryHistory.location;
      locationSubject.next(memoryHistory.location);
    }
  }

  // This creates a sort of proxy over the memory location just to add the localStorage persistence and the location
  // observer. We could achieve the same effect by a listener but that would create a memory leak as there would be no
  // reasonable way to unsubcribe the listener later on.
  // Another issue is that react router for some reason does not care about proper `this` binding and just calls these
  // as normal functions. So if this were to be a class we would still need to bind each of these methods to the
  // instance so at that moment this just seems easier.
  return {
    ...memoryHistory,
    // Getter aren't destructured as getter but as values, so they have to be still here even though we are not
    // modifying them.
    get index() {
      return memoryHistory.index;
    },
    get entries() {
      return memoryHistory.entries;
    },
    get length() {
      return memoryHistory.length;
    },
    get action() {
      return memoryHistory.action;
    },
    get location() {
      return memoryHistory.location;
    },
    push(location: H.Path | H.LocationDescriptor<H.LocationState>, state?: H.LocationState) {
      memoryHistory.push(location, state);
      maybeUpdateLocation();
    },
    replace(location: H.Path | H.LocationDescriptor<H.LocationState>, state?: H.LocationState) {
      memoryHistory.replace(location, state);
      maybeUpdateLocation();
    },
    go(n: number) {
      memoryHistory.go(n);
      maybeUpdateLocation();
    },
    goBack() {
      memoryHistory.goBack();
      maybeUpdateLocation();
    },
    goForward() {
      memoryHistory.goForward();
      maybeUpdateLocation();
    },
    getLocationObservable() {
      return locationSubject.asObservable();
    },
  };
}
