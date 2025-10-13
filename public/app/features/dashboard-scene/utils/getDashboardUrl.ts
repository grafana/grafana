import { UrlQueryMap, urlUtil } from '@grafana/data';
import { config, locationSearchToObject } from '@grafana/runtime';

export interface DashboardUrlOptions {
  uid?: string;
  slug?: string;
  subPath?: string;
  updateQuery?: UrlQueryMap;
  /** Set to location.search to preserve current params */
  currentQueryParams: string;
  /** * Returns solo panel route instead */
  soloRoute?: boolean;
  /** return render url */
  render?: boolean;
  /** Return an absolute URL */
  absolute?: boolean;
  // Add tz to query params
  timeZone?: string;
  // Check if we are on the home dashboard
  isHomeDashboard?: boolean;
  isSnapshot?: boolean;
}

export function getDashboardUrl(options: DashboardUrlOptions) {
  let path = `/d/${options.uid}`;

  if (!options.uid) {
    path = '/dashboard/new';
  }

  if (options.isSnapshot) {
    path = `/dashboard/snapshot/${options.uid}`;
  }

  if (options.soloRoute) {
    path = `/d-solo/${options.uid}`;
  }

  if (options.slug) {
    path += `/${options.slug}`;
  }

  if (options.subPath) {
    path += options.subPath;
  }

  if (options.render) {
    path = '/render' + path;

    options.updateQuery = {
      ...options.updateQuery,
      width: options.updateQuery?.width || 1000,
      height: options.updateQuery?.height || 500,
      tz: options.timeZone,
    };
  }

  if (options.isHomeDashboard) {
    path = '/';
  }

  const params = options.currentQueryParams ? locationSearchToObject(options.currentQueryParams) : {};

  delete params['shareView'];

  if (options.updateQuery) {
    for (const key in options.updateQuery) {
      // removing params with null | undefined
      if (options.updateQuery[key] === null || options.updateQuery[key] === undefined) {
        delete params[key];
      } else {
        params[key] = options.updateQuery[key];
      }
    }
  }

  const relativeUrl = urlUtil.renderUrl(path, params);

  if (options.absolute) {
    return config.appUrl + relativeUrl.slice(1);
  }

  return relativeUrl;
}
