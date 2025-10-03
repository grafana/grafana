/**
 * @TODO move this to some shared package, currently copied from Grafana core (app/api/utils)
 */

import { config } from '@grafana/runtime';

export const getAPINamespace = () => config.namespace;

export const getAPIBaseURL = (group: string, version: string) => {
  const subPath = config.appSubUrl || '';
  return `${subPath}/apis/${group}/${version}/namespaces/${getAPINamespace()}` as const;
};

// By including the version in the reducer path we can prevent cache bugs when different versions of the API are used for the same entities
export const getAPIReducerPath = (group: string, version: string) => `${group}/${version}` as const;

/**
 * Check if a string is well-formed UTF-16 (no lone surrogates).
 * encodeURIComponent() throws an error for lone surrogates
 */
export const isWellFormed = (str: string): boolean => {
  try {
    encodeURIComponent(str);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Base64URL encode a string using native browser APIs.
 * Handles Unicode characters correctly by using TextEncoder.
 * Converts standard base64 to base64url by replacing + with -, / with _, and removing padding.
 * @throws Error if the input string contains lone surrogates (malformed UTF-16)
 */
export const base64UrlEncode = (value: string): string => {
  // Check if the string is well-formed UTF-16
  if (!isWellFormed(value)) {
    throw new Error(`Cannot encode malformed UTF-16 string with lone surrogates: ${value}`);
  }

  // Encode UTF-8 string to bytes
  const bytes = new TextEncoder().encode(value);

  // Convert bytes to base64
  const binString = String.fromCodePoint(...bytes);
  const base64 = btoa(binString);

  // Convert to base64url format
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};
