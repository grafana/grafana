import { matchPath } from 'react-router-dom-v5-compat';

import { config } from '@grafana/runtime';

import { type ProxyContext, type RouteProxy } from './types';

export function stripSubPath(pathname: string): string {
  const subPath = config.appSubUrl;
  return subPath && pathname.startsWith(subPath) ? pathname.slice(subPath.length) : pathname;
}

/**
 * `pathname` must be Grafana's sub path already stripped and otherwise untouched — see the note on
 * `ProxyContext.pathname` for why we don't decode it.
 */
export function buildProxyContext(routePath: string, pathname: string, search: string): ProxyContext {
  // No match means no params, which every matcher reads as "not data source managed". That's the
  // safe outcome: we leave the page where it is.
  const match = matchPath(routePath, pathname);

  return {
    pathname,
    params: match?.params ?? {},
    searchParams: new URLSearchParams(search),
  };
}

/**
 * Runs a proxy end to end against a location. The route wrapper does these two steps separately so
 * it can skip the plugin check when the matcher says no, but for tests one call is easier to read.
 */
export async function resolveProxyTarget(
  proxy: RouteProxy,
  pathname: string,
  search: string
): Promise<string | undefined> {
  const context = buildProxyContext(proxy.path, pathname, search);
  return proxy.matches(context) ? proxy.handler(context) : undefined;
}
