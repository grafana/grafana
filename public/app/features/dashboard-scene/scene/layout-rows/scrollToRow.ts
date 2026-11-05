import { sceneGraph, type SceneObject } from '@grafana/scenes';

import { type DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isRowItem, isTabItem, type RowItemLike } from '../types/LayoutItemTypeGuards';

function getRepeatSourceKey(object: SceneObject): string | undefined {
  return 'repeatSourceKey' in object.state && typeof object.state.repeatSourceKey === 'string'
    ? object.state.repeatSourceKey
    : undefined;
}

/**
 * Row slugs are only unique among siblings, so the url value is the row's slug prefixed
 * with the slugs of all ancestor rows/tabs, e.g. `Row-2/Row-1` for a row nested in another row.
 *
 * Each segment is encodeURIComponent'd so a title containing `/` (e.g. `Foo/Bar` → `Foo%2FBar`)
 * cannot collide with a nested path (`Foo` + `Bar` → `Foo/Bar`).
 */
export function getRowSlugPath(row: RowItemLike): string {
  const segments = [row.getSlug()];

  let previous: SceneObject = row;
  let ancestor = row.parent;
  while (ancestor) {
    if (isRowItem(ancestor) || isTabItem(ancestor)) {
      // Repeat clones are parented under their source row/tab in the scene graph
      // (they live in its repeatedRows/repeatedTabs state), but they render as siblings
      // of the source, so the source must not become a path segment.
      const repeatSourceKey = getRepeatSourceKey(previous);
      const ancestorIsRepeatSource = repeatSourceKey !== undefined && repeatSourceKey === ancestor.state.key;
      if (!ancestorIsRepeatSource) {
        segments.unshift(ancestor.getSlug());
      }
      previous = ancestor;
    }
    ancestor = ancestor.parent;
  }

  return segments.map(encodeURIComponent).join('/');
}

/** Returns the row matching the slug path, if any, after scrolling it into view */
export function scrollToRow(drow: string, layout: DashboardLayoutManager): RowItemLike | undefined {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const row = (sceneGraph.findAllObjects(layout, isRowItem) as RowItemLike[]).find(
    (row) => getRowSlugPath(row) === drow
  );

  if (!row) {
    return undefined;
  }

  if (row.getCollapsedState()) {
    row.setCollapsedState(false);
  }

  row.scrollIntoView();
  return row;
}

/** How long the layout must stay unchanged before we stop keeping the row in view */
const LAYOUT_SETTLE_MS = 1000;
/** Upper bound so a layout that keeps resizing cannot hold the scroll position forever */
const MAX_FOLLOW_MS = 10_000;
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
/** Other keys, like a modifier pressed to switch apps while the dashboard loads, must not cancel the row link */
const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
]);

/**
 * The browser keeps animating a smooth scrollIntoView after we stop following the row and lets it override
 * the user's own scrolling, so stop it by scrolling every container to where it is now.
 */
function stopScrollAnimation(element: HTMLElement) {
  for (let target = element.parentElement; target; target = target.parentElement) {
    target.scrollTo({ top: target.scrollTop, left: target.scrollLeft, behavior: 'instant' });
  }
}

/**
 * When a dashboard is opened from a row link, the row is scrolled to before the layouts above it
 * have their final height (grids only render their panels once they have measured their width),
 * so the row is pushed out of view again once they render. Scroll the row back into view whenever
 * it or anything containing it resizes, until the layout has settled or the user scrolls.
 *
 * Returns a function that stops following the row.
 */
export function keepRowInViewWhileLayoutSettles(row: RowItemLike): () => void {
  let observer: ResizeObserver | undefined;
  let frame: number | undefined;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  const maxTimer = setTimeout(stop, MAX_FOLLOW_MS);

  function stop() {
    observer?.disconnect();
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
    }
    clearTimeout(settleTimer);
    clearTimeout(maxTimer);
    for (const event of USER_SCROLL_EVENTS) {
      window.removeEventListener(event, stopOnUserInput, true);
    }
  }

  function stopOnUserInput(event: Event) {
    if (event instanceof KeyboardEvent && !SCROLL_KEYS.has(event.key)) {
      return;
    }

    const element = row.containerRef.current;
    if (element) {
      stopScrollAnimation(element);
    }
    stop();
  }

  function observe() {
    const element = row.containerRef.current;
    // The row is not rendered yet on page load, so wait for it
    if (!element?.isConnected) {
      frame = requestAnimationFrame(observe);
      return;
    }

    frame = undefined;
    observer = new ResizeObserver(() => {
      // The dashboard was left, or the row was rendered again into a different element
      if (!element.isConnected || row.containerRef.current !== element) {
        stop();
        return;
      }

      row.scrollIntoView();
      clearTimeout(settleTimer);
      settleTimer = setTimeout(stop, LAYOUT_SETTLE_MS);
    });

    // Content growing above the row resizes one of its ancestors
    for (let target: HTMLElement | null = element; target; target = target.parentElement) {
      observer.observe(target);
    }
  }

  for (const event of USER_SCROLL_EVENTS) {
    window.addEventListener(event, stopOnUserInput, { capture: true, passive: true });
  }

  observe();
  return stop;
}
