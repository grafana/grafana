import { GrafanaConfig, RawTimeRange, ScopedVars } from '../types';
import { UrlQueryMap, urlUtil } from './url';
import { textUtil } from '../text';

let grafanaConfig: GrafanaConfig = { appSubUrl: '' } as any;
let getTimeRangeUrlParams: () => RawTimeRange;
let getVariablesUrlParams: (scopedVars?: ScopedVars) => UrlQueryMap;

/**
 *
 * @param url
 * @internal
 */
const stripBaseFromUrl = (url: string): string => {
  const appSubUrl = grafanaConfig.appSubUrl ?? '';
  const stripExtraChars = appSubUrl.endsWith('/') ? 1 : 0;
  const isAbsoluteUrl = url.startsWith('http');
  let segmentToStrip = appSubUrl;

  if (!url.startsWith('/')) {
    segmentToStrip = `${window.location.origin}${appSubUrl}`;
  }

  if (isAbsoluteUrl) {
    segmentToStrip = url.startsWith(`${window.location.origin}${appSubUrl}`)
      ? `${window.location.origin}${appSubUrl}`
      : `${window.location.origin}`;
  }

  return url.length > 0 && url.indexOf(segmentToStrip) === 0 ? url.slice(segmentToStrip.length - stripExtraChars) : url;
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
  processUrl: (url: string) => {
    return grafanaConfig.disableSanitizeHtml ? url : textUtil.sanitizeUrl(url);
  },
};
