import { GrafanaConfig, RawTimeRange, ScopedVars } from '../types';
import { urlUtil } from './url';
import { textUtil } from '../text';

let grafanaConfig: GrafanaConfig = { appSubUrl: '' } as any;
let getTimeRangeUrlParams: () => RawTimeRange;
let getVariablesUrlParams: (params?: Record<string, any>, scopedVars?: ScopedVars) => string;

/**
 *
 * @param url
 * @internal
 */
const stripBaseFromUrl = (url: string): string => {
  const appSubUrl = grafanaConfig.appSubUrl ?? '';
  const stripExtraChars = appSubUrl.endsWith('/') ? 1 : 0;
  const urlWithoutBase =
    url.length > 0 && url.indexOf(appSubUrl) === 0 ? url.slice(appSubUrl.length - stripExtraChars) : url;

  return urlWithoutBase;
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
  buildParamsFromVariables: (params: any, scopedVars?: ScopedVars) => string;
}

export const locationUtil = {
  /**
   *
   * @param getConfig
   * @param buildParamsFromVariables
   * @param getTimeRangeForUrl
   * @internal
   */
  initialize: ({ config, buildParamsFromVariables, getTimeRangeForUrl }: LocationUtilDependencies) => {
    grafanaConfig = config;
    getTimeRangeUrlParams = getTimeRangeForUrl;
    getVariablesUrlParams = buildParamsFromVariables;
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
    const params = {};
    getVariablesUrlParams(params, scopedVars);
    return urlUtil.toUrlParams(params);
  },
  processUrl: (url: string) => {
    return grafanaConfig.disableSanitizeHtml ? url : textUtil.sanitizeUrl(url);
  },
};
