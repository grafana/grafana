import * as H from 'history';

//TODO[Router] replace with LocationSrv
import { LocationService as LocationServiceAPI, LocationUpdate } from '@grafana/runtime';
import { locationUtil } from '@grafana/data';
import { navigationLogger, queryStringToJSON, setViewModeBodyClass } from './utils';
import { KioskUrlValue } from '../../types';

//TODO[Router] replace with LocationSrv
export class LocationService implements LocationServiceAPI {
  private readonly history: H.History;
  private fullPageReloadRoutes = ['/logout'];

  constructor(history?: H.History<any>) {
    this.history = history || H.createBrowserHistory();

    this.history.listen((update) => {
      navigationLogger('LocationService', false, 'history.listen', update);
      const urlWithoutBase = locationUtil.stripBaseFromUrl(update.pathname);
      if (this.fullPageReloadRoutes.indexOf(urlWithoutBase) > -1) {
        window.location.href = update.pathname;
        return;
      }

      const mode = queryStringToJSON(update.search).kiosk as KioskUrlValue;
      setViewModeBodyClass(mode);
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
      this.partial(options.query, options.replace);
    }
    if (options.replace) {
      this.replace(options.path!);
    }
    this.push(options.path!);
  }
}
