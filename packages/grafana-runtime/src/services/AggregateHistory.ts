import * as H from 'history';
import { BehaviorSubject, Observable } from 'rxjs';

// For new URL() to correctly parse the url it needs to have domain and protocol so we add a dummy one. It does not
// matter what it is as long as it is a valid URL as we use only pathname, search and hash from it.
const dummyDomain = 'http://sidecar';

/**
 * Given a full aggregated location with both main and secondary url in a single query param, returns a partial
 * location that is requested depending on the isMain flag.
 * @param location Full aggregated URL
 * @param param Name of the query param for secondary location
 * @param isMain
 */
function getPartialLocation(location: H.Location, param: string, isMain: boolean): H.Location {
  const newLocation = { ...location };
  const paramsCopy = new URLSearchParams(newLocation.search);
  if (isMain) {
    paramsCopy.delete(param);
    newLocation.search = paramsCopy.toString();
    return newLocation;
  } else {
    if (paramsCopy.has(param)) {
      const url = paramsCopy.get(param);
      const parsed = new URL(dummyDomain + url);
      return {
        pathname: parsed.pathname,
        search: parsed.search,
        hash: parsed.hash,
        state: undefined,
      };
    } else {
      return {
        pathname: '',
        search: '',
        hash: '',
        state: undefined,
      };
    }
  }
}

/**
 * Given a main or secondary location returns a location that has both of them in single URL. Inverse of
 * getPartialLocation().
 * @param newPartialLocation Main or secondary location that should changed
 * @param currentFullLocation Current full location, so both main and secondary location inside a query param
 * @param param The name of the param for secondary location
 * @param isMain
 */
function partialLocationToFull(
  newPartialLocation: H.Location,
  currentFullLocation: H.Location,
  param: string,
  isMain: boolean
) {
  const newPartialLocationCopy = { ...newPartialLocation };
  const currentFullLocationCopy = { ...currentFullLocation };
  if (isMain) {
    // get current secondary location, which we are not changing but we need to add it to the new main location as
    // search param.
    const secondaryLocation = getPartialLocation(currentFullLocationCopy, param, false);
    if (secondaryLocation.pathname !== '') {
      const paramsCopy = new URLSearchParams(newPartialLocationCopy.search);
      paramsCopy.set(param, secondaryLocation.pathname + secondaryLocation.search);
      newPartialLocationCopy.search = paramsCopy.toString();
    }
    return newPartialLocationCopy;
  } else {
    // we keep the current location as it is and just change the secondary location in the search param
    const paramsCopy = new URLSearchParams(currentFullLocationCopy.search);
    if (newPartialLocationCopy.pathname === '') {
      paramsCopy.delete(param);
    } else {
      paramsCopy.set(param, newPartialLocationCopy.pathname + newPartialLocationCopy.search);
    }
    currentFullLocationCopy.search = paramsCopy.toString();
    return currentFullLocationCopy;
  }
}

/**
 * Because history api can accept either simple string location or an object we normalize the string one into an object
 * so we can consider only one type of location later on.
 * @param location
 */
function normalizeLocation(location: H.Path | H.LocationDescriptor<unknown>): H.Location {
  if (typeof location === 'string') {
    const url = new URL(dummyDomain + location);
    return {
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      state: undefined,
    };
  }
  return {
    ...location,
    pathname: location.pathname || '',
    search: location.search || '',
    state: location.state || undefined,
    hash: location.hash || '',
  };
}

type LocalStorageHistoryOptions = {
  // Name of the query param in which the secondary location is stored. Should be something unique enough so there
  // isn't a clash with other query params.
  param: string;

  actualHistory: H.History;

  // Whether this history is handling the main location or secondary one in the query param.
  isMain: boolean;
};

interface LocationStorageHistory extends H.History {
  getLocationObservable(): Observable<H.Location | undefined>;
}

/**
 * Wrapper over regular history that, depending on the isMain option saves the URL normally or in a query param. This
 * way we can handle 2 URLs at the same time without clashing.
 * @param options
 */
export function createAggregateHistory(options: LocalStorageHistoryOptions): LocationStorageHistory {
  let currentLocation = getPartialLocation(options.actualHistory.location, options.param, options.isMain);
  const locationSubject = new BehaviorSubject<H.Location | undefined>(currentLocation);

  options.actualHistory.listen((location) => {
    const partialLocation = getPartialLocation(location, options.param, options.isMain);
    locationSubject.next(partialLocation);
  });

  return {
    ...options.actualHistory,
    get length() {
      return options.actualHistory.length;
    },
    get action() {
      return options.actualHistory.action;
    },
    get location() {
      return getPartialLocation(options.actualHistory.location, options.param, options.isMain);
    },
    listen(listener: H.LocationListener<H.LocationState>): H.UnregisterCallback {
      return options.actualHistory.listen((location, action) => {
        const partialLocation = getPartialLocation(location, options.param, options.isMain);
        return listener(partialLocation, action);
      });
    },
    push(location: H.Path | H.LocationDescriptor<H.LocationState>, state?: H.LocationState) {
      options.actualHistory.push(
        partialLocationToFull(
          normalizeLocation(location),
          options.actualHistory.location,
          options.param,
          options.isMain
        ),
        state
      );
    },
    replace(location: H.Path | H.LocationDescriptor<H.LocationState>, state?: H.LocationState) {
      options.actualHistory.replace(
        partialLocationToFull(
          normalizeLocation(location),
          options.actualHistory.location,
          options.param,
          options.isMain
        ),
        state
      );
    },
    go(n: number) {
      options.actualHistory.go(n);
    },
    goBack() {
      options.actualHistory.goBack();
    },
    goForward() {
      options.actualHistory.goForward();
    },
    getLocationObservable() {
      return locationSubject.asObservable();
    },
  };
}
