import { Location } from 'history';

import { textUtil } from '../text';
import { GrafanaConfig, RawTimeRange, ScopedVars } from '../types';

import { UrlQueryMap, urlUtil } from './url';

let grafanaConfig: GrafanaConfig = { appSubUrl: '' } as any;
let getTimeRangeUrlParams: () => RawTimeRange;
let getVariablesUrlParams: (scopedVars?: ScopedVars) => UrlQueryMap;

const maybeParseUrl = (input: string): URL | undefined => {
  try {
    return new URL(input);
  } catch {
    return undefined;
  }
};

/**
 *
 * @param url
 * @internal
 */
const stripBaseFromUrl = (urlOrPath: string): string => {
  // Will only return a URL object if the input is actually a valid URL
  const parsedUrl = maybeParseUrl(urlOrPath);
  if (parsedUrl) {
    // If the input is a URL, and for a different origin that we're on, just bail
    // and return it. There's no need to strip anything from it
    if (parsedUrl.origin !== window.location.origin) {
      return urlOrPath;
    }
  }

  const appSubUrl = grafanaConfig.appSubUrl ?? '';
  const stripExtraChars = appSubUrl.endsWith('/') ? 1 : 0;
  const isAbsoluteUrl = urlOrPath.startsWith('http');

  let segmentToStrip = appSubUrl;

  if (!urlOrPath.startsWith('/') || isAbsoluteUrl) {
    segmentToStrip = `${window.location.origin}${appSubUrl}`;
  }

  return urlOrPath.length > 0 && urlOrPath.indexOf(segmentToStrip) === 0
    ? urlOrPath.slice(segmentToStrip.length - stripExtraChars)
    : urlOrPath;
};

/**
 *
 * @param url
 * @internal
 */
const assureBaseUrl = (url: string): string => {
  if (url.startsWith('/')) {
    return `${grafanaConfig.appSubUrl}${stripBaseFromUrl(url)}`;
  }
  return url;
};

/**
 *
 * @param location
 * @param searchParamsToUpdate
 * @returns
 */
const getUrlForPartial = (location: Location<any>, searchParamsToUpdate: Record<string, any>) => {
  const searchParams = urlUtil.parseKeyValue(
    location.search.startsWith('?') ? location.search.substring(1) : location.search
  );
  for (const key of Object.keys(searchParamsToUpdate)) {
    // removing params with null | undefined
    if (searchParamsToUpdate[key] === null || searchParamsToUpdate[key] === undefined) {
      delete searchParams[key];
    } else {
      searchParams[key] = searchParamsToUpdate[key];
    }
  }
  return assureBaseUrl(urlUtil.renderUrl(location.pathname, searchParams));
};

/**
 * @deprecated use `getUrlForPartial` instead
 * Update URL or search param string `init` with new params `partial`.
 */
const updateSearchParams = (init: string, partial: string) => {
  const urlSearchParams = new URLSearchParams(partial);

  // Check if full URL
  try {
    const curURL = new URL(init);
    urlSearchParams.forEach((val, key) => curURL.searchParams.set(key, val));
    return curURL.href;
  } catch {
    // assume search params
    const newSearchParams = new URLSearchParams(init);
    urlSearchParams.forEach((v, k) => {
      newSearchParams.set(k, v);
    });
    return '?' + newSearchParams.toString();
  }
};

interface LocationUtilDependencies {
  config: GrafanaConfig;
  getTimeRangeForUrl: () => RawTimeRange;
  getVariablesUrlParams: (scopedVars?: ScopedVars) => UrlQueryMap;
}

export const locationUtil = {
  /**
   *
   * @param getConfig
   * @param getAllVariableValuesForUrl
   * @param getTimeRangeForUrl
   * @internal
   */
  initialize: (dependencies: LocationUtilDependencies) => {
    grafanaConfig = dependencies.config;
    getTimeRangeUrlParams = dependencies.getTimeRangeForUrl;
    getVariablesUrlParams = dependencies.getVariablesUrlParams;
  },
  stripBaseFromUrl,
  assureBaseUrl,
  updateSearchParams,
  getTimeRangeUrlParams: () => {
    if (!getTimeRangeUrlParams) {
      return null;
    }
    return urlUtil.toUrlParams(getTimeRangeUrlParams());
  },
  getVariablesUrlParams: (scopedVars?: ScopedVars) => {
    if (!getVariablesUrlParams) {
      return null;
    }
    const params = getVariablesUrlParams(scopedVars);
    return urlUtil.toUrlParams(params);
  },
  getUrlForPartial,
  processUrl: (url: string) => {
    return grafanaConfig.disableSanitizeHtml ? url : textUtil.sanitizeUrl(url);
  },
};
