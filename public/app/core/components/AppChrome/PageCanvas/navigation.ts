import { locationService } from '@grafana/runtime';

import { type PageCanvasModel, type PageCanvasTab } from './types';

/** Whether two lists hold the same values, in any order. */
function sameValues(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedB = [...b].sort();
  return [...a].sort().every((value, index) => value === sortedB[index]);
}

/**
 * Whether the page at `href` is showing: the same path, with each of the href's params at the same values, such as a
 * multi-value variable's selection. The URL can carry params the href leaves out, such as `orgId` or a plugin's own
 * canvas params, and the hash doesn't count.
 */
function isShowing(href: string): boolean {
  const { pathname, search } = locationService.getLocation();
  const [beforeHash] = href.split('#');
  const queryStart = beforeHash.indexOf('?');
  const path = queryStart === -1 ? beforeHash : beforeHash.slice(0, queryStart);
  if (path !== pathname) {
    return false;
  }
  const current = new URLSearchParams(search);
  const wanted = new URLSearchParams(queryStart === -1 ? '' : beforeHash.slice(queryStart + 1));
  return [...new Set(wanted.keys())].every((key) => sameValues(wanted.getAll(key), current.getAll(key)));
}

/** Sends the router to `href`, unless the page there is already showing. */
function showPage(href: string) {
  if (!isShowing(href)) {
    locationService.push(href);
  }
}

/** Selects `tab`, showing its Grafana page first when the tab is one. A closed tab reopens. */
export function selectPageCanvasTab(canvas: PageCanvasModel, tab: PageCanvasTab) {
  if (tab.shows === 'page' && tab.href) {
    showPage(tab.href);
  }
  canvas.onSelect(tab.id);
}

/** Whether "Open as a Grafana page" applies to `tab`. */
export function canOpenAsPage(canvas: PageCanvasModel, tab: PageCanvasTab | undefined): tab is PageCanvasTab {
  return tab?.href !== undefined && canvas.onOpenAsPage !== undefined;
}

/** Leaves the canvas for the tab's own Grafana page. */
export function openPageCanvasTabAsPage(canvas: PageCanvasModel, tab: PageCanvasTab) {
  if (!tab.href || !canvas.onOpenAsPage) {
    return;
  }
  showPage(tab.href);
  canvas.onOpenAsPage(tab.id);
}

/** `order` with `moving` placed before or after `target`. */
export function moveTabId(order: readonly string[], moving: string, target: string, after: boolean): string[] {
  if (moving === target || !order.includes(moving) || !order.includes(target)) {
    return [...order];
  }
  const rest = order.filter((id) => id !== moving);
  const index = rest.indexOf(target) + (after ? 1 : 0);
  return [...rest.slice(0, index), moving, ...rest.slice(index)];
}
