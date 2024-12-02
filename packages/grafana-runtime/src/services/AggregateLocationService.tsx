import * as H from 'history';
import { BehaviorSubject, map, Observable } from 'rxjs';

import { locationSearchToObject, LocationService } from './LocationService';
import { LocationUpdate } from './LocationSrv';

/** @internal */
export class AggregateHistoryWrapper implements LocationService {
  private locationService: LocationService;
  private isMain: boolean;
  private param: string;

  constructor(options: { locationService: LocationService; param: string; isMain: boolean }) {
    this.locationService = options.locationService;
    this.param = options.param;
    this.isMain = options.isMain;

    this.partial = this.partial.bind(this);
    this.push = this.push.bind(this);
    this.replace = this.replace.bind(this);
    this.getSearch = this.getSearch.bind(this);
    this.getHistory = this.getHistory.bind(this);
    this.getLocation = this.getLocation.bind(this);
  }

  getLocationObservable() {
    return this.locationService.getLocationObservable().pipe(
      map((location) => {
        // TODO filter events where only the specific sections changes
        console.log('aggregate getLocationObservable', this.isMain ? 'main' : 'sidecar', location);
        if (this.isMain) {
          const newLocation = { ...location };
          const params = new URLSearchParams(newLocation.search);
          params.delete(this.param);
          newLocation.search = params.toString();
          return newLocation;
        } else {
          const params = new URLSearchParams(location.search);
          const secondary = decodeURIComponent(params.get(this.param) || '');
          const parsed = new URL('http://sidecar' + secondary);
          return {
            pathname: parsed.pathname,
            search: parsed.search,
            hash: parsed.hash,
            state: undefined,
          };
        }
      })
    );
  }

  getHistory() {
    // TODO: maybe better to wrap the history itself?
    return this.locationService.getHistory();
  }

  getSearch() {
    const params = this.locationService.getSearch();
    if (this.isMain) {
      const paramsCopy = new URLSearchParams(params.toString());
      paramsCopy.delete(this.param);
      return paramsCopy;
    } else {
      const url = decodeURIComponent(params.get(this.param) || '');
      const parsed = new URL('http://sidecar' + url);
      return parsed.searchParams;
    }
  }

  partial(query: Record<string, any>, replace?: boolean) {
    // TODO This should still work the same, maybe just make sure we don't overwrite the this.param param
    return this.locationService.partial(query, replace);
  }

  push(location: H.Path | H.LocationDescriptor) {
    console.log('before', this.locationService.getLocation());
    const newLoc = this.aggregateLocation(location);
    console.log('new', newLoc);
    const result = this.locationService.push(newLoc);
    console.log('after', this.locationService.getLocation());
    return result;
  }

  private aggregateLocation(location: H.Path | H.LocationDescriptor): H.LocationDescriptor {
    if (this.isMain) {
      const params = this.locationService.getSearch();
      const secondaryURL = params.get(this.param);
      if (!secondaryURL) {
        // If there is no secondary URL there is nothing we have to do to location
        return location;
      } else {
        // Add the current secondary URL to the new location before pushing
        const parsedLocation =
          typeof location === 'string'
            ? new URL('http://sidecar' + location)
            : new URL('http://sidecar' + (location.pathname || '') + (location.search || ''));
        parsedLocation.searchParams.set(this.param, encodeURIComponent(secondaryURL));
        // TODO: hash/state/key
        return parsedLocation;
      }
    } else {
      const currentLocation = this.locationService.getLocation();
      const params = new URLSearchParams(currentLocation.search);
      if (typeof location === 'string') {
        params.set(this.param, encodeURIComponent(location));
      } else {
        params.set(this.param, encodeURIComponent((location.pathname || '/') + (location.search || '')));
      }

      return {
        ...currentLocation,
        search: params.toString(),
      };
    }
  }

  replace(location: H.Path | H.LocationDescriptor) {
    return this.locationService.replace(this.aggregateLocation(location));
  }

  reload() {
    return this.locationService.reload();
  }

  getLocation() {
    if (this.isMain) {
      const location = this.locationService.getLocation();
      const newLocation = { ...location };
      newLocation.search = this.getSearch().toString();
      return newLocation;
    } else {
      const search = this.locationService.getSearch();
      const secondary = decodeURIComponent(search.get(this.param) || '/');
      const parsed = new URL('http://sidecar' + secondary);
      return {
        pathname: parsed.pathname,
        search: parsed.search,
        hash: parsed.hash,
        state: undefined,
      };
    }
  }

  getSearchObject() {
    const search = { ...this.locationService.getSearchObject() };
    if (this.isMain) {
      delete search[this.param];
      return search;
    } else {
      const params = this.locationService.getSearch();
      const url = decodeURIComponent(params.get(this.param) || '/');
      const parsed = new URL('http://sidecar' + url);
      return locationSearchToObject(parsed.searchParams.toString());
    }
  }

  /** @deprecated use partial, push or replace instead */
  update(options: LocationUpdate) {
    return this.locationService.update(options);
  }
}

type LocalStorageHistoryOptions = {
  param: string;
  actualHistory: H.History;
  isMain: boolean;
};

interface LocationStorageHistory extends H.History {
  getLocationObservable(): Observable<H.Location | undefined>;
}

function getPartialLocation(location: H.Location, param: string, isMain: boolean): H.Location {
  const newLocation = { ...location };
  const paramsCopy = new URLSearchParams(newLocation.search);
  if (isMain) {
    paramsCopy.delete(param);
    newLocation.search = paramsCopy.toString();
    return newLocation;
  } else {
    const url = decodeURIComponent(paramsCopy.get(param) || '');
    const parsed = new URL('http://sidecar' + url);
    return {
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      state: undefined,
    };
  }
}

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
    const paramsCopy = new URLSearchParams(newPartialLocationCopy.search);
    paramsCopy.set(param, encodeURIComponent(secondaryLocation.pathname + secondaryLocation.search));
    newPartialLocationCopy.search = paramsCopy.toString();
    return newPartialLocationCopy;
  } else {
    // we keep the current location as it is and just change the secondary location in the search param
    const paramsCopy = new URLSearchParams(currentFullLocationCopy.search);
    paramsCopy.set(param, encodeURIComponent(newPartialLocationCopy.pathname + newPartialLocationCopy.search));
    currentFullLocationCopy.search = paramsCopy.toString();
    return currentFullLocationCopy;
  }
}

function normalizeLocation(location: H.Path | H.LocationDescriptor<unknown>): H.Location {
  if (typeof location === 'string') {
    const url = new URL('http://grafana' + location);
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

export function createAggregateHistory(options: LocalStorageHistoryOptions): LocationStorageHistory {
  let currentLocation = getPartialLocation(options.actualHistory.location, options.param, options.isMain);
  const locationSubject = new BehaviorSubject<H.Location | undefined>(currentLocation);

  options.actualHistory.listen((location) => {
    const partialLocation = getPartialLocation(location, options.param, options.isMain);
    console.log('listen', options.isMain ? 'main' : 'sidecar', partialLocation);
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
      console.log('push', options.isMain ? 'main' : 'sidecar', location);
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
      console.log('replace', options.isMain ? 'main' : 'sidecar', location);
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
