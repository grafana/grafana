import { locationUtil, type NavModelItem } from '@grafana/data';
import { findNavByUrl } from 'app/core/navtree/utils';

import { type PageIdentity } from './types';

/** Carried on many URLs without saying anything about the page's state. */
export const PLUMBING_PARAMS = ['orgId', 'returnTo'];

/**
 * `pathname?a=1&b=2` with plumbing and empty params dropped and the rest sorted, so two URLs that open the same
 * view compare equal however they were written.
 */
function canonicalUrl(url: string): string {
  const at = url.indexOf('?');
  const [pathname, search] = at === -1 ? [url, ''] : [url.slice(0, at), url.slice(at)];
  const params = new URLSearchParams(
    [...new URLSearchParams(search)].filter(([key, value]) => value && !PLUMBING_PARAMS.includes(key))
  );
  params.sort();
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Create forms: `…/new`, and `/alerting/new/:type`. What is typed into one lives in the form, not the URL. */
function isCreateForm(pathname: string): boolean {
  return pathname.endsWith('/new') || pathname.startsWith('/alerting/new/');
}

/**
 * A nav menu destination opened the way the menu opens it is one click away; a create form reopens blank. Neither
 * is worth a row of its own. Both are judged by the URL as a whole: a menu link that carries a tab counts as the
 * menu opens it, the same page with another tab (a filter, prefilled values, ...) is state to come back to. Pages
 * the menu does not link to (a rule, an incident) always are. Starred dashboards are nav items too, so dashboards
 * are exempt. The tree is the menu as it is now: the boot copy is empty when the client builds the menu.
 */
export function hasNothingToResume(page: PageIdentity, search: string, navTree: NavModelItem[]): boolean {
  if (page.kind === 'dashboard') {
    return false;
  }
  const pathname = locationUtil.assureBaseUrl(page.pathname);
  const url = canonicalUrl(pathname + search);
  if (isCreateForm(page.pathname)) {
    return url === pathname;
  }
  return findNavByUrl(navTree, (navUrl) => canonicalUrl(navUrl) === url) !== undefined;
}
