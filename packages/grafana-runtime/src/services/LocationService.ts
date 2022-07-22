import * as H from 'history';

import { deprecationWarning, UrlQueryMap, urlUtil } from '@grafana/data';
import { attachDebugger, createLogger } from '@grafana/ui';

import { config } from '../config';

import { LocationUpdate } from './LocationSrv';

/**
 * @public
 * A wrapper to help work with browser location and history
 */
export interface LocationService {
  partial: (query: Record<string, any>, replace?: boolean) => void;
  push: (location: H.Path | H.LocationDescriptor<any>) => void;
  replace: (location: H.Path | H.LocationDescriptor<any>) => void;
  reload: () => void;
  getLocation: () => H.Location;
  getHistory: () => H.History;
  getSearch: () => URLSearchParams;
  getSearchObject: () => UrlQueryMap;

  /**
   * This is from the old LocationSrv interface
   * @deprecated use partial, push or replace instead */
  update: (update: LocationUpdate) => void;
}

/** @internal */
export class HistoryWrapper implements LocationService {
  private readonly history: H.History;

  constructor(history?: H.History) {
    // If no history passed create an in memory one if being called from test
    this.history =
      history ||
      (process.env.NODE_ENV === 'test'
        ? H.createMemoryHistory({ initialEntries: ['/'] })
        : H.createBrowserHistory({ basename: config.appSubUrl ?? '/' }));

    this.partial = this.partial.bind(this);
    this.push = this.push.bind(this);
    this.replace = this.replace.bind(this);
    this.getSearch = this.getSearch.bind(this);
    this.getHistory = this.getHistory.bind(this);
    this.getLocation = this.getLocation.bind(this);
  }

  getHistory() {
    return this.history;
  }

  getSearch() {
    return new URLSearchParams(this.history.location.search);
  }

  partial(query: Record<string, any>, replace?: boolean) {
    const currentLocation = this.history.location;
    const newQuery = this.getSearchObject();

    for (const key of Object.keys(query)) {
      // removing params with null | undefined
      if (query[key] === null || query[key] === undefined) {
        delete newQuery[key];
      } else {
        newQuery[key] = query[key];
      }
    }

    const updatedUrl = urlUtil.renderUrl(currentLocation.pathname, newQuery);

    if (replace) {
      this.history.replace(updatedUrl, this.history.location.state);
    } else {
      this.history.push(updatedUrl, this.history.location.state);
    }
  }

  push(location: H.Path | H.LocationDescriptor) {
    this.history.push(location);
  }

  replace(location: H.Path | H.LocationDescriptor) {
    this.history.replace(location);
  }

  reload() {
    const prevState = (this.history.location.state as any)?.routeReloadCounter;
    this.history.replace({
      ...this.history.location,
      state: { routeReloadCounter: prevState ? prevState + 1 : 1 },
    });
  }

  getLocation() {
    return this.history.location;
  }

  getSearchObject() {
    return locationSearchToObject(this.history.location.search);
  }

  /** @deprecated use partial, push or replace instead */
  update(options: LocationUpdate) {
    deprecationWarning('LocationSrv', 'update', 'partial, push or replace');
    if (options.partial && options.query) {
      this.partial(options.query, options.partial);
    } else {
      const newLocation: H.LocationDescriptor = {
        pathname: options.path,
      };
      if (options.query) {
        newLocation.search = urlUtil.toUrlParams(options.query);
      }
      if (options.replace) {
        this.replace(newLocation);
      } else {
        this.push(newLocation);
      }
    }
  }
}

/**
 * @public
 * Parses a location search string to an object
 * */
export function locationSearchToObject(search: string | number): UrlQueryMap {
  let queryString = typeof search === 'number' ? String(search) : search;

  if (queryString.length > 0) {
    if (queryString.startsWith('?')) {
      return urlUtil.parseKeyValue(queryString.substring(1));
    }
    return urlUtil.parseKeyValue(queryString);
  }

  return {};
}

/**
 * @public
 */
export let locationService: LocationService = new HistoryWrapper();

/**
 * Used for tests only
 * @internal
 */
export const setLocationService = (location: LocationService) => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('locationService can be only overriden in test environment');
  }
  locationService = location;
};

const navigationLog = createLogger('Router');

/** @internal */
export const navigationLogger = navigationLog.logger;

// For debugging purposes the location service is attached to global _debug variable
attachDebugger('location', locationService, navigationLog);
