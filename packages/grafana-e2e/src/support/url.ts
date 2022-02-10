import { e2e } from '../index';

const getBaseUrl = () => e2e.env('BASE_URL') || e2e.config().baseUrl || 'http://localhost:3000';

export const fromBaseUrl = (url = '') => new URL(url, getBaseUrl()).href;

export const getDashboardUid = (url: string): string => {
  const matches = new URL(url).pathname.match(/\/d\/([^/]+)/);
  if (!matches) {
    throw new Error(`Couldn't parse uid from ${url}`);
  } else {
    return matches[1];
  }
};

/**
 * Parses an escaped url query string into key-value pairs.
 * Attribution: Code dervived from https://github.com/angular/angular.js/master/src/Angular.js#L1396
 * @returns {Object.<string,boolean|Array>}
 */
export function parseKeyValue(keyValue: string) {
  var obj: any = {};
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
