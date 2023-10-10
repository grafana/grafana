import { locationUtil, UrlQueryMap, urlUtil } from '@grafana/data';
import { config, locationSearchToObject, locationService } from '@grafana/runtime';

export interface DashboardUrlOptions {
  uid?: string;
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
}

export function getDashboardUrl(options: DashboardUrlOptions) {
  let path = `/scenes/dashboard/${options.uid}${options.subPath ?? ''}`;

  if (options.soloRoute) {
    path = `/d-solo/${options.uid}${options.subPath ?? ''}`;
  }

  if (options.render) {
    path = '/render' + path;

    options.updateQuery = {
      ...options.updateQuery,
      width: 1000,
      height: 500,
      tz: options.timeZone,
    };
  }

  const params = options.currentQueryParams ? locationSearchToObject(options.currentQueryParams) : {};

  if (options.updateQuery) {
    for (const key of Object.keys(options.updateQuery)) {
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

export function getViewPanelUrl(panelKey: string) {
  return locationUtil.getUrlForPartial(locationService.getLocation(), { viewPanel: panelKey });
}
