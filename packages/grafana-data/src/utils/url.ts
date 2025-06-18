/**
 * @preserve jquery-param (c) 2015 KNOWLEDGECODE | MIT
 */

import { isDateTime } from '../datetime/moment_wrapper';
import { ExploreUrlState, URLRange } from '../types/explore';
import { RawTimeRange } from '../types/time';

/**
 * Type to represent the value of a single query variable.
 *
 * @public
 */
export type UrlQueryValue = string | number | boolean | string[] | number[] | boolean[] | undefined | null;

/**
 * Type to represent the values parsed from the query string.
 *
 * @public
 */
export type UrlQueryMap = Record<string, UrlQueryValue>;

function renderUrl(path: string, query: UrlQueryMap | undefined): string {
  if (query && Object.keys(query).length > 0) {
    path += '?' + toUrlParams(query);
  }
  return path;
}

function encodeURIComponentAsAngularJS(val: EncodeURIComponentParams, pctEncodeSpaces?: boolean) {
  return encodeURIComponent(val)
    .replace(/%40/gi, '@')
    .replace(/%3A/gi, ':')
    .replace(/%24/g, '$')
    .replace(/%2C/gi, ',')
    .replace(/%3B/gi, ';')
    .replace(/%20/g, pctEncodeSpaces ? '%20' : '+')
    .replace(/[!'()*]/g, function (c) {
      return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    });
}

type EncodeURIComponentParams = Parameters<typeof encodeURIComponent>[0];
/**
 *  Encodes URL parameters in the style of AngularJS.
 *  Use `serializeParams` to encode parameters using `encodeURIComponent` instead.
 */
function toUrlParams(a: any, encodeAsAngularJS = true) {
  const s: any[] = [];
  const rbracket = /\[\]$/;

  const encodingFunction = encodeAsAngularJS
    ? (value: EncodeURIComponentParams, pctEncodeSpaces?: boolean) =>
        encodeURIComponentAsAngularJS(value, pctEncodeSpaces)
    : (value: EncodeURIComponentParams, _: boolean) => encodeURIComponent(value);

  const isArray = (obj: unknown) => {
    return Object.prototype.toString.call(obj) === '[object Array]';
  };

  const add = (k: string, v: any) => {
    v = typeof v === 'function' ? v() : v === null ? '' : v === undefined ? '' : v;
    s[s.length] = encodingFunction(k, true) + '=' + encodingFunction(v, true);
  };

  const buildParams = (prefix: string, obj: any) => {
    let i, len, key;

    if (prefix) {
      if (isArray(obj)) {
        for (i = 0, len = obj.length; i < len; i++) {
          if (rbracket.test(prefix)) {
            add(prefix, obj[i]);
          } else {
            buildParams(prefix, obj[i]);
          }
        }
      } else if (obj && String(obj) === '[object Object]') {
        for (key in obj) {
          buildParams(prefix + '[' + key + ']', obj[key]);
        }
      } else {
        add(prefix, obj);
      }
    } else if (isArray(obj)) {
      for (i = 0, len = obj.length; i < len; i++) {
        add(obj[i].name, obj[i].value);
      }
    } else {
      for (key in obj) {
        buildParams(key, obj[key]);
      }
    }
    return s;
  };

  return buildParams('', a).join('&');
}

/**
 * Converts params into a URL-encoded query string.
 *
 * @param params data to serialize
 * @returns A URL-encoded string representing the provided data.
 */
function serializeParams(params: unknown): string {
  return toUrlParams(params, false);
}

function appendQueryToUrl(url: string, stringToAppend: string) {
  if (stringToAppend !== undefined && stringToAppend !== null && stringToAppend !== '') {
    const pos = url.indexOf('?');
    if (pos !== -1) {
      if (url.length - pos > 1) {
        url += '&';
      }
    } else {
      url += '?';
    }
    url += stringToAppend;
  }

  return url;
}

/**
 * Return search part (as object) of current url
 */
function getUrlSearchParams(): UrlQueryMap {
  const search = window.location.search.substring(1);
  const searchParamsSegments = search.split('&');
  const params: UrlQueryMap = {};
  for (const p of searchParamsSegments) {
    const keyValuePair = p.split('=');
    if (keyValuePair.length > 1) {
      // key-value param
      const key = decodeURIComponent(keyValuePair[0]);
      const value = decodeURIComponent(keyValuePair[1]);
      if (key in params) {
        params[key] = [...(params[key] as any[]), value];
      } else {
        params[key] = [value];
      }
    } else if (keyValuePair.length === 1) {
      // boolean param
      const key = decodeURIComponent(keyValuePair[0]);
      params[key] = true;
    }
  }
  return params;
}

/**
 * Parses an escaped url query string into key-value pairs.
 * Attribution: Code dervived from https://github.com/angular/angular.js/master/src/Angular.js#L1396
 * @returns {Object.<string,boolean|Array>}
 */
export function parseKeyValue(keyValue: string) {
  const obj: any = {};
  const parts = (keyValue || '').split('&');

  for (let keyValue of parts) {
    let splitPoint: number | undefined;
    let key: string | undefined;
    let val: string | undefined | boolean;

    if (keyValue) {
      key = keyValue = keyValue.replace(/\+/g, '%20');
      splitPoint = keyValue.indexOf('=');

      if (splitPoint !== -1) {
        key = keyValue.substring(0, splitPoint);
        val = keyValue.substring(splitPoint + 1);
      }

      key = tryDecodeURIComponent(key);

      if (key !== undefined) {
        val = val !== undefined ? tryDecodeURIComponent(val as string) : true;

        let parsedVal: any;
        if (typeof val === 'string' && val !== '') {
          parsedVal = val === 'true' || val === 'false' ? val === 'true' : val;
        } else {
          parsedVal = val;
        }

        if (!obj.hasOwnProperty(key)) {
          obj[key] = isNaN(parsedVal) ? val : parsedVal;
        } else if (Array.isArray(obj[key])) {
          obj[key].push(val);
        } else {
          obj[key] = [obj[key], isNaN(parsedVal) ? val : parsedVal];
        }
      }
    }
  }

  return obj;
}

function tryDecodeURIComponent(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return undefined;
  }
}

export const urlUtil = {
  renderUrl,
  toUrlParams,
  appendQueryToUrl,
  getUrlSearchParams,
  parseKeyValue,
  serializeParams,
};

/**
 * Create an string that is used in URL to represent the Explore state. This is basically just a stringified json
 * that is used as a state of a single Explore pane so it does not represent full Explore URL so some properties
 * may be omitted (they will be filled in with default values).
 *
 * @param urlState
 * @param compact this parameter is deprecated and will be removed in a future release.
 */
export function serializeStateToUrlParam(urlState: Partial<ExploreUrlState>, compact?: boolean): string {
  if (compact !== undefined) {
    console.warn('`compact` parameter is deprecated and will be removed in a future release');
  }
  return JSON.stringify(urlState);
}

/**
 * Converts RawTimeRange to a string that is stored in the URL
 * - relative - stays as it is (e.g. "now")
 * - absolute - converted to ms
 */
export const toURLRange = (range: RawTimeRange): URLRange => {
  let from = range.from;
  if (isDateTime(from)) {
    from = from.valueOf().toString();
  }

  let to = range.to;
  if (isDateTime(to)) {
    to = to.valueOf().toString();
  }

  return {
    from,
    to,
  };
};
