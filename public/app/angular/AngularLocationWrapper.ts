import { deprecationWarning, urlUtil } from '@grafana/data';
import { locationSearchToObject, locationService, navigationLogger } from '@grafana/runtime';

// Ref: https://github.com/angular/angular.js/blob/ae8e903edf88a83fedd116ae02c0628bf72b150c/src/ng/location.js#L5
const DEFAULT_PORTS: Record<string, number> = { http: 80, https: 443, ftp: 21 };

export class AngularLocationWrapper {
  constructor() {
    this.absUrl = this.wrapInDeprecationWarning(this.absUrl);
    this.hash = this.wrapInDeprecationWarning(this.hash);
    this.host = this.wrapInDeprecationWarning(this.host);
    this.path = this.wrapInDeprecationWarning(this.path);
    this.port = this.wrapInDeprecationWarning(this.port, 'window.location');
    this.protocol = this.wrapInDeprecationWarning(this.protocol, 'window.location');
    this.replace = this.wrapInDeprecationWarning(this.replace);
    this.search = this.wrapInDeprecationWarning(this.search);
    this.state = this.wrapInDeprecationWarning(this.state);
    this.url = this.wrapInDeprecationWarning(this.url);
  }

  wrapInDeprecationWarning(fn: Function, replacement?: string) {
    let self = this;

    return function wrapper() {
      deprecationWarning('$location', fn.name, replacement || 'locationService');
      return fn.apply(self, arguments);
    };
  }

  absUrl(): string {
    return `${window.location.origin}${this.url()}`;
  }

  hash(newHash?: string | null) {
    navigationLogger('AngularLocationWrapper', false, 'Angular compat layer: hash');

    if (!newHash) {
      return locationService.getLocation().hash.slice(1);
    } else {
      throw new Error('AngularLocationWrapper method not implemented.');
    }
  }

  host(): string {
    return new URL(window.location.href).hostname;
  }

  path(pathname?: any) {
    navigationLogger('AngularLocationWrapper', false, 'Angular compat layer: path');

    const location = locationService.getLocation();

    if (pathname !== undefined && pathname !== null) {
      let parsedPath = String(pathname);
      parsedPath = parsedPath.startsWith('/') ? parsedPath : `/${parsedPath}`;
      const url = new URL(`${window.location.origin}${parsedPath}`);

      locationService.push({
        pathname: url.pathname,
        search: url.search.length > 0 ? url.search : location.search,
        hash: url.hash.length > 0 ? url.hash : location.hash,
      });
      return this;
    }

    if (pathname === null) {
      locationService.push('/');
      return this;
    }

    return location.pathname;
  }

  port(): number | null {
    const url = new URL(window.location.href);
    return parseInt(url.port, 10) || DEFAULT_PORTS[url.protocol] || null;
  }

  protocol(): string {
    return new URL(window.location.href).protocol.slice(0, -1);
  }

  replace() {
    throw new Error('AngularLocationWrapper method not implemented.');
  }

  search(search?: any, paramValue?: any) {
    navigationLogger('AngularLocationWrapper', false, 'Angular compat layer: search');
    if (!search) {
      return locationService.getSearchObject();
    }

    if (search && arguments.length > 1) {
      locationService.partial({
        [search]: paramValue,
      });

      return this;
    }

    if (search) {
      let newQuery;

      if (typeof search === 'object') {
        newQuery = { ...search };
      } else {
        newQuery = locationSearchToObject(search);
      }

      for (const key of Object.keys(newQuery)) {
        // removing params with null | undefined
        if (newQuery[key] === null || newQuery[key] === undefined) {
          delete newQuery[key];
        }
      }

      const updatedUrl = urlUtil.renderUrl(locationService.getLocation().pathname, newQuery);
      locationService.push(updatedUrl);
    }

    return this;
  }

  state(state?: any) {
    navigationLogger('AngularLocationWrapper', false, 'Angular compat layer: state');
    throw new Error('AngularLocationWrapper method not implemented.');
  }

  url(newUrl?: any) {
    navigationLogger('AngularLocationWrapper', false, 'Angular compat layer: url');

    if (newUrl !== undefined) {
      if (newUrl.startsWith('#')) {
        locationService.push({ ...locationService.getLocation(), hash: newUrl });
      } else if (newUrl.startsWith('?')) {
        locationService.push({ ...locationService.getLocation(), search: newUrl });
      } else if (newUrl.trim().length === 0) {
        locationService.push('/');
      } else {
        locationService.push(newUrl);
      }

      return locationService;
    }

    const location = locationService.getLocation();
    return `${location.pathname}${location.search}${location.hash}`;
  }
}
