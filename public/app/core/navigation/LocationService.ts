import { createBrowserHistory, History, Location, LocationState, LocationDescriptorObject } from 'history';
import parseKeyValue, { isString, isNumber, isObject, forEach, isUndefined } from './utils/parseKeyValue';
import { queryString } from './utils/queryString';
import locationUtil from '../utils/location_util';

let locationServiceInstance: LocationService;

export class LocationService {
  private history: History;
  private fullPageReloadRoutes = ['/logout'];

  constructor(history?: History<any>) {
    this.history = history || createBrowserHistory();

    this.history.listen(location => {
      const urlWithoutBase = locationUtil.stripBaseFromUrl(location.pathname);
      if (this.fullPageReloadRoutes.indexOf(urlWithoutBase) > -1) {
        window.location.href = location.pathname;
        return;
      }
    });
  }

  getUrlSearchParams = () => {
    return new URLSearchParams(this.history.location.search);
  };

  partial = (query: Record<string, any>, replace?: boolean) => {
    const currentLocation = this.history.location;
    const params = this.getUrlSearchParams();

    for (const key of Object.keys(query)) {
      if (params.has(key)) {
        // removing params with null | undefined
        if (query[key] === null || query[key] === undefined) {
          params.delete(key);
        } else {
          params.set(key, query[key]);
        }
      } else {
        // ignoring params with null | undefined values
        if (query[key] !== null && query[key] !== undefined) {
          params.append(key, query[key]);
        }
      }
    }

    const locationUpdate: Location<LocationState> = {
      ...currentLocation,
      search: params.toString(),
    };

    if (replace) {
      this.history.replace(locationUpdate);
    } else {
      this.history.push(locationUpdate);
    }
  };

  push = (location: LocationDescriptorObject) => {
    this.history.push(location);
  };

  replace = (location: LocationDescriptorObject) => {
    this.history.replace(location);
  };

  absUrl() {
    // TODO
  }

  url(url?: string): string | void {
    const { location } = this.history;
    if (!url) {
      return `${location.pathname}${location.search}${location.hash}`;
    }
    this.history.push(url);
  }

  path(path?: string): string | void {
    const { location } = this.history;
    if (!path) {
      return `${location.pathname}`;
    } else {
      let newPath = `${path}${location.search}${location.hash}`;
      if (!path.startsWith('/')) {
        newPath = '/' + newPath;
      }

      this.history.push(newPath);
    }
  }

  pathReplace(path: string): string | void {
    const { location } = this.history;

    let newPath = `${path}${location.search}${location.hash}`;
    if (!path.startsWith('/')) {
      newPath = '/' + newPath;
    }

    this.history.replace(newPath);
  }

  hash() {
    return this.history.location.hash;
  }

  search(search: any, paramValue: any): any {
    // This is a makover of original Angular's implementation.
    // It uses history instead of $location internals
    switch (arguments.length) {
      case 0:
        const query = this.history.location.search;
        return parseKeyValue(query.slice(1));
      case 1:
        if (isString(search) || isNumber(search)) {
          search = search.toString();
          this.history.push({
            pathname: this.history.location.pathname,
            hash: this.history.location.hash,
            search: `?${search}`,
            state: this.history.location.state,
          });
          // TODO
          // this.$$search = parseKeyValue(search);
        } else if (isObject(search)) {
          const newSearch = { ...search };
          // remove object undefined or null properties
          forEach(newSearch, (value: any, key: any) => {
            if (value == null) {
              delete newSearch[key];
            }
          });

          this.history.push({
            pathname: this.history.location.pathname,
            hash: this.history.location.hash,
            search: `?${queryString(newSearch)}`,
            state: this.history.location.state,
          });
        } else {
          throw new Error('The first argument of the `$location#search()` call must be a string or an object.');
        }
        break;
      default:
        if (isUndefined(paramValue) || paramValue === null) {
          const newSearch = { ...search };
          delete newSearch[search];
          this.history.push({
            pathname: this.history.location.pathname,
            hash: this.history.location.hash,
            search: `?${queryString(newSearch)}`,
            state: this.history.location.state,
          });
        } else {
          const newSearch = parseKeyValue(this.history.location.search.slice(1));
          // @ts-ignore
          newSearch[search] = paramValue;
          this.history.push({
            pathname: this.history.location.pathname,
            hash: this.history.location.hash,
            search: `?${queryString(newSearch)}`,
            state: this.history.location.state,
          });
        }
    }
  }

  // replace(url: string) {
  //   if (url) {
  //     this.history.replace(url);
  //   }
  // }

  getHistory() {
    return this.history;
  }
}

const locationService = () => {
  if (locationServiceInstance) {
    return locationServiceInstance;
  }

  locationServiceInstance = new LocationService();
  return locationServiceInstance;
};

export const getLocationService = () => {
  return locationService();
};

export const setLocationService = (service: LocationService) => {
  locationServiceInstance = service;
};

//TODO refactor calls to locationService().X() to plain function calls -> X() that would use locationService underneath
export default locationService;
