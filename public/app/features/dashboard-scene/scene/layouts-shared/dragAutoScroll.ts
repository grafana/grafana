import { selectors } from '@grafana/e2e-selectors';

/** How close to the edge of a scroll container the pointer has to be for a drag to scroll it */
export const AUTO_SCROLL_EDGE_PX = 80;
/** Edge size for a tab bar, which is much smaller than the page */
export const AUTO_SCROLL_HORIZONTAL_EDGE_PX = 48;
/** Scroll speed at the edge and past it, in pixels per frame */
export const AUTO_SCROLL_MAX_SPEED_PX = 24;
/** A press only becomes a drag once the pointer moved this far, so a click near the edge never scrolls */
const ACTIVATION_DISTANCE_PX = 4;

const DASHBOARD_SCROLL_CONTAINER_SELECTOR = `[data-testid="${selectors.components.DashboardSidebarSplitter.bodyContainer}"]`;

/**
 * Scroll speed, in pixels per frame, for a pointer `distance` pixels inside an edge zone that is `edgeSize` pixels
 * wide. Zero at the inner border of the zone, growing faster towards the edge, so the user controls the speed by
 * how close to the edge they hold the pointer. Past the edge (a negative distance) it is the full speed.
 */
export function getAutoScrollSpeed(
  distance: number,
  edgeSize = AUTO_SCROLL_EDGE_PX,
  maxSpeed = AUTO_SCROLL_MAX_SPEED_PX
): number {
  if (distance >= edgeSize) {
    return 0;
  }
  const depth = Math.min(1, (edgeSize - distance) / edgeSize);
  return Math.max(1, Math.round(maxSpeed * depth * depth));
}

/**
 * Signed speed along one axis for a pointer between `start` and `end` (the visible part of a scroll container):
 * negative near `start`, positive near `end`, zero in between.
 */
export function getAxisScrollSpeed(pointer: number, start: number, end: number, edgeSize: number): number {
  // Small containers would otherwise scroll from anywhere in them
  const edge = Math.min(edgeSize, (end - start) / 3);
  const towardsStart = getAutoScrollSpeed(pointer - start, edge);
  if (towardsStart > 0) {
    return -towardsStart;
  }
  return getAutoScrollSpeed(end - pointer, edge);
}

/**
 * The element the dashboard scrolls in while it is edited: the body next to the edit pane, or the document when
 * the dashboard is shown without the edit pane
 */
export function getDashboardScrollContainer(): HTMLElement {
  const body = document.querySelector(DASHBOARD_SCROLL_CONTAINER_SELECTOR);
  if (body instanceof HTMLElement) {
    return body;
  }
  return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : document.documentElement;
}

export interface DragAutoScrollOptions {
  /**
   * Called after the scroll position changed during the drag, by the drag itself or by the user, e.g. with the
   * mouse wheel. Content moved under the resting pointer, so the drag re-runs its pointer logic (hit-testing,
   * previews) at the last pointer position.
   */
  onScroll(): void;
  /** Also scrolls elements under the pointer that scroll sideways, e.g. a tab bar with more tabs than fit */
  horizontal?: boolean;
  getScrollContainer?: () => HTMLElement | null;
}

interface Scrolled {
  element: Element;
  left: number;
  top: number;
}

/**
 * Scrolls the dashboard while something is dragged with the pointer near the top or bottom of it, once per frame,
 * faster the closer the pointer is to the edge. Used by every drag on the unified drag and drop engine: the drag
 * passes each pointer move to `update` and calls `stop` when it ends.
 */
export class DragAutoScroller {
  private _pointer: { x: number; y: number } | null = null;
  private _origin: { x: number; y: number } | null = null;
  private _isActive = false;
  private _frame: number | null = null;
  private _isListening = false;
  /** Positions this scroller left elements at, so their scroll events are not reported a second time */
  private _scrolled: Scrolled[] = [];

  public constructor(private readonly _options: DragAutoScrollOptions) {}

  /** Where the pointer was pressed. Without it, the first pointer move counts as the press. */
  public start(x: number, y: number) {
    this._origin = { x, y };
  }

  /** The pointer position of the drag */
  public update(x: number, y: number) {
    this._pointer = { x, y };
    if (!this._origin) {
      this._origin = { x, y };
    }
    if (!this._isActive && Math.hypot(x - this._origin.x, y - this._origin.y) >= ACTIVATION_DISTANCE_PX) {
      this._isActive = true;
    }
    if (!this._isListening) {
      this._isListening = true;
      window.addEventListener('scroll', this._onScrollEvent, { capture: true, passive: true });
    }
    if (this._isActive && this._frame === null) {
      this._frame = requestAnimationFrame(this._step);
    }
  }

  public stop() {
    if (this._frame !== null) {
      cancelAnimationFrame(this._frame);
      this._frame = null;
    }
    if (this._isListening) {
      window.removeEventListener('scroll', this._onScrollEvent, { capture: true });
      this._isListening = false;
    }
    this._pointer = null;
    this._origin = null;
    this._isActive = false;
    this._scrolled = [];
  }

  private _step = () => {
    this._frame = null;
    const pointer = this._pointer;
    if (!pointer) {
      return;
    }

    this._scrolled = [];
    const container = this._options.getScrollContainer?.() ?? getDashboardScrollContainer();
    if (container) {
      this._scrollVertically(container, pointer);
    }
    if (this._options.horizontal) {
      this._scrollHorizontally(pointer);
    }

    // Stops once nothing scrolls any more, away from the edges or at the end of the content. The next pointer
    // move starts it again.
    if (this._scrolled.length > 0) {
      this._options.onScroll();
      // The drag may have ended in there
      if (this._pointer) {
        this._frame = requestAnimationFrame(this._step);
      }
    }
  };

  private _scrollVertically(container: HTMLElement, pointer: { x: number; y: number }) {
    if (container.scrollHeight <= container.clientHeight) {
      return;
    }
    const rect = getVisibleRect(container);
    if (pointer.x < rect.left || pointer.x > rect.right) {
      return;
    }
    const speed = getAxisScrollSpeed(pointer.y, rect.top, rect.bottom, AUTO_SCROLL_EDGE_PX);
    if (speed !== 0) {
      this._scrollBy(container, 0, speed);
    }
  }

  private _scrollHorizontally(pointer: { x: number; y: number }) {
    const element = findHorizontalScroller(pointer.x, pointer.y);
    if (!element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const speed = getAxisScrollSpeed(pointer.x, rect.left, rect.right, AUTO_SCROLL_HORIZONTAL_EDGE_PX);
    if (speed !== 0) {
      this._scrollBy(element, speed, 0);
    }
  }

  private _scrollBy(element: Element, left: number, top: number) {
    const before = { left: element.scrollLeft, top: element.scrollTop };
    if (left !== 0) {
      element.scrollLeft += left;
    }
    if (top !== 0) {
      element.scrollTop += top;
    }
    if (element.scrollLeft !== before.left || element.scrollTop !== before.top) {
      this._scrolled.push({ element, left: element.scrollLeft, top: element.scrollTop });
    }
  }

  private _onScrollEvent = (evt: Event) => {
    if (!this._pointer) {
      return;
    }
    const target = evt.target instanceof Document ? evt.target.scrollingElement : evt.target;
    const own = this._scrolled.find((scrolled) => scrolled.element === target);
    // Already handled right after scrolling, in the same frame
    if (own && own.element.scrollLeft === own.left && own.element.scrollTop === own.top) {
      return;
    }
    this._options.onScroll();
  };
}

function getVisibleRect(container: Element): { top: number; bottom: number; left: number; right: number } {
  if (container === document.scrollingElement || container === document.documentElement) {
    return { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
  }
  const rect = container.getBoundingClientRect();
  return {
    top: Math.max(rect.top, 0),
    bottom: Math.min(rect.bottom, window.innerHeight),
    left: Math.max(rect.left, 0),
    right: Math.min(rect.right, window.innerWidth),
  };
}

function findHorizontalScroller(x: number, y: number): Element | undefined {
  return document.elementsFromPoint(x, y).find((element) => {
    if (element.scrollWidth <= element.clientWidth) {
      return false;
    }
    const { overflowX } = getComputedStyle(element);
    return overflowX === 'auto' || overflowX === 'scroll';
  });
}
