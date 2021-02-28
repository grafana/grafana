import { locationUtil } from '@grafana/data';
import * as H from 'history';
import { LocationUpdate } from './LocationSrv';
import createMemoryHistory from 'history/createMemoryHistory';
import { createLogger } from '@grafana/ui';

export interface LocationService {
  partial: (query: Record<string, any>, replace?: boolean) => void;
  push: (location: H.Path | H.LocationDescriptor<any>) => void;
  replace: (location: H.Path) => void;
  getCurrentLocation: () => H.Location;
  getHistory: () => H.History;
  getSearch: () => URLSearchParams;

  /**
   * This is from the old LocationSrv interface
   * @deprecated use partial, push or replace instead */
  update: (update: LocationUpdate) => void;
}

class HistoryWrapper implements LocationService {
  private readonly history: H.History;
  private fullPageReloadRoutes = ['/logout'];

  constructor(history?: H.History) {
    // If no history passed create an in memory one if being called from test
    this.history =
      history || process.env.NODE_ENV === 'test'
        ? createMemoryHistory({ initialEntries: ['/'] })
        : H.createBrowserHistory();

    this.history.listen((update) => {
      navigationLogger('LocationService', false, 'history.listen', update);
      const urlWithoutBase = locationUtil.stripBaseFromUrl(update.pathname);

      if (this.fullPageReloadRoutes.indexOf(urlWithoutBase) > -1) {
        window.location.href = update.pathname;
        return;
      }
      // const mode = queryStringToJSON(update.search).kiosk as KioskUrlValue;
      // setViewModeBodyClass(mode);
    });

    // For debugging purposes the location service is attached to global _debug variable
    if (process.env.NODE_ENV !== 'production') {
      // @ts-ignore
      let debugGlobal = window['_debug'];
      if (debugGlobal) {
        debugGlobal = {
          ...debugGlobal,
          location: this,
        };
      } else {
        debugGlobal = {
          location: this,
        };
      }
      // @ts-ignore
      window['_debug'] = debugGlobal;
    }

    this.partial = this.partial.bind(this);
    this.push = this.push.bind(this);
    this.replace = this.replace.bind(this);
    this.getSearch = this.getSearch.bind(this);
    this.getHistory = this.getHistory.bind(this);
    this.getCurrentLocation = this.getCurrentLocation.bind(this);
  }

  getHistory() {
    return this.history;
  }

  getSearch() {
    return new URLSearchParams(this.history.location.search);
  }

  partial(query: Record<string, any>, replace?: boolean) {
    const currentLocation = this.history.location;
    const params = this.getSearch();

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

    const locationUpdate: H.Location = {
      ...currentLocation,
      search: params.toString(),
    };

    if (replace) {
      this.history.replace(locationUpdate);
    } else {
      this.history.push(locationUpdate);
    }
  }

  push(location: H.Path | H.LocationDescriptor) {
    this.history.push(location);
  }

  replace(location: H.Path) {
    this.history.replace(location);
  }

  getCurrentLocation() {
    return this.history.location;
  }

  /** @depecreated */
  update(options: LocationUpdate) {
    if (options.partial && options.query) {
      this.partial(options.query, options.partial);
    } else if (options.replace) {
      this.replace(options.path!);
    } else {
      this.push(options.path!);
    }
  }
}

/** @internal maybe move in to a LocationService function getSearchObj? */
export function queryStringToJSON(queryString: string) {
  const params: Array<[string, string | boolean]> = [];
  new URLSearchParams(queryString).forEach((v, k) => params.push([k, parseValue(v)]));
  return Object.fromEntries(new Map(params));
}

function parseValue(value: string) {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
}

export const locationService: LocationService = new HistoryWrapper();

/** @internal */
export const navigationLogger = createLogger('Router');
