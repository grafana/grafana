import * as H from 'history';
import React, { useContext } from 'react';
import { BehaviorSubject, type Observable } from 'rxjs';

import { deprecationWarning, type UrlQueryMap, urlUtil } from '@grafana/data';
import { attachDebugger, createLogger } from '@grafana/ui';

import { config } from '../config';

import { type LocationUpdate } from './LocationSrv';

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
  getLocationObservable: () => Observable<H.Location>;

  /**
   * This is from the old LocationSrv interface
   * @deprecated use partial, push or replace instead */
  update: (update: LocationUpdate) => void;
}

/**
 * Wraps `H.History` so every navigation — programmatic push/replace,
 * `<Link>` clicks, and `<a href>` rendering via createHref — flows through
 * `appendOrgId` at one chokepoint. `getHistory()` returns `this`, so
 * react-router uses the wrapper too.
 * @internal
 */
export class HistoryWrapper implements LocationService, H.History {
  private readonly base: H.History;
  private locationObservable: BehaviorSubject<H.Location>;
  private orgIdGetter?: () => number;

  constructor(history?: H.History) {
    this.base =
      history ||
      (process.env.NODE_ENV === 'test'
        ? H.createMemoryHistory({ initialEntries: ['/'] })
        : H.createBrowserHistory({ basename: config.appSubUrl ?? '/' }));

    this.locationObservable = new BehaviorSubject(this.base.location);
    this.base.listen((location) => this.locationObservable.next(location));
  }

  // The history library mutates these on the base instance after each
  // navigation, so getters keep readers in sync.
  get length() {
    return this.base.length;
  }
  get action() {
    return this.base.action;
  }
  get location() {
    return this.base.location;
  }

  // Arrow class fields auto-bind, so detached calls (`const m = history.push; m(loc)`)
  // keep `this` and the orgId injection still fires.
  push: H.History['push'] = (location, state) => this.base.push(this.appendOrgId(location), state);
  replace: H.History['replace'] = (location, state) => this.base.replace(this.appendOrgId(location), state);
  createHref: H.History['createHref'] = (location) =>
    this.base.createHref(this.appendOrgId(location) as H.LocationDescriptorObject);

  go: H.History['go'] = (n) => this.base.go(n);
  goBack: H.History['goBack'] = () => this.base.goBack();
  goForward: H.History['goForward'] = () => this.base.goForward();
  block: H.History['block'] = (prompt) => this.base.block(prompt);
  listen: H.History['listen'] = (listener) => this.base.listen(listener);

  setOrgIdGetter(fn: () => number) {
    this.orgIdGetter = fn;
  }

  appendOrgId(location: H.Path | H.LocationDescriptor): H.Path | H.LocationDescriptor {
    const orgId = this.orgIdGetter?.() ?? 0;
    if (!Number.isFinite(orgId) || orgId <= 0) {
      return location;
    }
    const orgIdStr = String(Math.floor(orgId));

    if (typeof location === 'string') {
      const url = new URL(location, 'http://_');
      if (url.searchParams.has('orgId')) {
        return location;
      }
      url.searchParams.set('orgId', orgIdStr);
      return { pathname: url.pathname, search: url.search, hash: url.hash };
    }

    const params = new URLSearchParams(location.search ?? '');
    if (params.has('orgId')) {
      return location;
    }
    params.set('orgId', orgIdStr);
    return { ...location, search: `?${params.toString()}` };
  }

  // LocationService
  getLocationObservable() {
    return this.locationObservable.asObservable();
  }

  getHistory() {
    return this;
  }

  getSearch() {
    return new URLSearchParams(this.base.location.search);
  }

  getLocation() {
    return this.base.location;
  }

  getSearchObject() {
    return locationSearchToObject(this.base.location.search);
  }

  partial(query: Record<string, any>, replace?: boolean) {
    const currentLocation = this.base.location;
    const newQuery = this.getSearchObject();

    for (const key in query) {
      // removing params with null | undefined
      if (query[key] === null || query[key] === undefined) {
        delete newQuery[key];
      } else {
        newQuery[key] = query[key];
      }
    }

    const updatedUrl = urlUtil.renderUrl(currentLocation.pathname, newQuery);

    if (replace) {
      this.replace(updatedUrl, currentLocation.state);
    } else {
      this.push(updatedUrl, currentLocation.state);
    }
  }

  reload() {
    const prevState = (this.base.location.state as any)?.routeReloadCounter;
    this.base.replace({
      ...this.base.location,
      state: { routeReloadCounter: prevState ? prevState + 1 : 1 },
    });
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

// Simple context so the location service can be used without being a singleton
const LocationServiceContext = React.createContext<LocationService | undefined>(undefined);

export function useLocationService(): LocationService {
  const service = useContext(LocationServiceContext);
  if (!service) {
    throw new Error('useLocationService must be used within a LocationServiceProvider');
  }
  return service;
}

export const LocationServiceProvider: React.FC<{ service: LocationService; children: React.ReactNode }> = ({
  service,
  children,
}) => {
  return <LocationServiceContext.Provider value={service}>{children}</LocationServiceContext.Provider>;
};
