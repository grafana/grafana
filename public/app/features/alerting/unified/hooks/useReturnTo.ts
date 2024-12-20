import { textUtil } from '@grafana/data';
import { config } from '@grafana/runtime';

import { logWarning } from '../Analytics';

import { useURLSearchParams } from './useURLSearchParams';

/**
 * This hook provides a safe way to obtain the `returnTo` URL from the query string parameter
 * It validates the origin and protocol to ensure the URL is withing the Grafana app
 */
export function useReturnTo(fallback?: string): { returnTo: string | undefined } {
  const emptyResult = { returnTo: fallback };

  const [searchParams] = useURLSearchParams();
  const returnTo = searchParams.get('returnTo');

  if (!returnTo) {
    return emptyResult;
  }

  const sanitizedReturnTo = textUtil.sanitizeUrl(returnTo);
  const baseUrl = `${window.location.origin}/${config.appSubUrl}`;

  const sanitizedUrl = tryParseURL(sanitizedReturnTo, baseUrl);

  if (!sanitizedUrl) {
    logWarning('Malformed returnTo parameter', { returnTo });
    return emptyResult;
  }

  const { protocol, origin, pathname, search } = sanitizedUrl;
  if (['http:', 'https:'].includes(protocol) === false || origin !== window.location.origin) {
    logWarning('Malformed returnTo parameter', { returnTo });
    return emptyResult;
  }

  return { returnTo: `${pathname}${search}` };
}

// Tries to mimic URL.parse method https://developer.mozilla.org/en-US/docs/Web/API/URL/parse_static
function tryParseURL(sanitizedReturnTo: string, baseUrl: string) {
  try {
    const url = new URL(sanitizedReturnTo, baseUrl);
    return url;
  } catch (error) {
    return null;
  }
}
