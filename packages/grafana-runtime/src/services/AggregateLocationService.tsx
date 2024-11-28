import * as H from 'history';
import { map } from 'rxjs';

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
