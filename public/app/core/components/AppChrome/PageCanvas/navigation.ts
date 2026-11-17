import { locationService } from '@grafana/runtime';

import { type PageCanvasModel, type PageCanvasTab } from './types';

/** Sends the router to `href`, unless the page there is already showing. */
function showPage(href: string) {
  const { pathname, search } = locationService.getLocation();
  if (`${pathname}${search}` !== href) {
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
