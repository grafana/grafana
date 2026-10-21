import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { store } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

/**
 * Put this attribute on an element inside the floating extension sidebar to make it the handle that moves
 * the floating container (pointer drag, arrow keys, Home or double-click to reset).
 */
export const FLOATING_DRAG_HANDLE_ATTRIBUTE = 'data-extension-floating-drag-handle';

const HANDLE_SELECTOR = `[${FLOATING_DRAG_HANDLE_ATTRIBUTE}]`;
/**
 * Space kept between the floating container and the edges of the page content. Smaller than the default
 * corner's inset, so the container can be lined up with the page's own panes.
 */
const GUTTER = 8;
/** A press that moves less than this is a click on the handle, not a drag. */
const DRAG_THRESHOLD = 4;
/** Let go closer than this to an edge of the page content, the container snaps to that edge. */
const SNAP_DISTANCE = 48;
/** A drag whose pointer reaches this close to the page content's right edge docks the sidebar when let go. */
const DOCK_DISTANCE = 32;
const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;
/** How long the container glides to an edge it snaps to; ExtensionSidebar's transition uses it too. */
export const FLOATING_SNAP_DURATION_MS = 150;
const OFFSET_LOCAL_STORAGE_KEY = 'grafana.navigation.extensionSidebarFloatingOffset';

interface Offset {
  x: number;
  y: number;
}

type Anchor = 'top' | 'bottom';

/**
 * Where the user left the container. `x` is the horizontal offset from the default place. The anchor is the
 * edge that stays put when the container grows or shrinks: for `bottom`, `y` is the vertical offset from the
 * default place; for `top`, it is the distance from the page content's top edge to the container's.
 */
interface Placement extends Offset {
  anchor: Anchor;
}

/** Where the docked sidebar would go, in viewport coordinates, shown while a drag would dock it. */
export interface DockPreview {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface FloatingDragOptions {
  /** The docked sidebar's width, for the preview. */
  dockWidth: number;
  onDock: () => void;
}

const ORIGIN: Offset = { x: 0, y: 0 };
const DEFAULT_PLACEMENT: Placement = { ...ORIGIN, anchor: 'bottom' };

function reportMoved(method: 'drag' | 'reset', anchor: Anchor): void {
  reportInteraction('grafana_extension_sidebar_floating_moved', { method, anchor });
}

/**
 * Moves the floating extension sidebar away from its default place at the bottom centre. The offset is a
 * translation of `element` from that place, kept fully inside the page content (with a gutter), and
 * re-clamped when the window or the element resizes. A pointer drag follows the pointer and the container
 * stays where it is let go, unless that is near an edge of the page content: then it glides to that edge,
 * inset as far as the default place is from the bottom. Pushing the pointer to the right edge of the page
 * docks the sidebar instead: the returned preview shows where while the pointer stays there, and letting go
 * calls `onDock`. The arrow keys move it in steps without snapping or docking. Left in the top half of the
 * page, it keeps its top edge and grows downward; in the bottom half, it keeps its bottom edge and grows
 * upward. The placement is remembered in local storage, so floating again, or a reload, puts it back; a
 * re-clamp never overwrites it, so it returns once there is room.
 */
export function useFloatingDrag(
  element: HTMLElement | null,
  { dockWidth, onDock }: FloatingDragOptions
): DockPreview | null {
  const offsetRef = useRef<Offset>(ORIGIN);
  const chosenRef = useRef<Placement>(DEFAULT_PLACEMENT);
  const [dockPreview, setDockPreview] = useState<DockPreview | null>(null);
  // The listeners are attached once per element, so they read the latest options through a ref.
  const optionsRef = useRef({ dockWidth, onDock });
  optionsRef.current = { dockWidth, onDock };

  const apply = useCallback(
    (next: Offset) => {
      if (!element) {
        return;
      }
      const clamped = clampOffset(element, offsetRef.current, next);
      offsetRef.current = clamped;
      element.style.transform = isOrigin(clamped) ? '' : `translate(${clamped.x}px, ${clamped.y}px)`;
    },
    [element]
  );

  const place = useCallback(
    (placement: Placement) => {
      if (element) {
        apply(placementToOffset(element, offsetRef.current, placement));
      }
    },
    [element, apply]
  );

  const remember = useCallback(() => {
    if (!element) {
      return;
    }
    const placement = offsetToPlacement(element, offsetRef.current);
    chosenRef.current = placement;
    if (placement.anchor === 'bottom' && isOrigin(placement)) {
      store.delete(OFFSET_LOCAL_STORAGE_KEY);
    } else {
      store.setObject(OFFSET_LOCAL_STORAGE_KEY, placement);
    }
  }, [element]);

  // Floating starts where the user left it; docking (the element going away) only clears the transform.
  useLayoutEffect(() => {
    if (!element) {
      return;
    }
    chosenRef.current = readStoredPlacement();
    place(chosenRef.current);
    return () => {
      offsetRef.current = ORIGIN;
      element.style.transform = '';
    };
  }, [element, place]);

  useEffect(() => {
    if (!element) {
      return;
    }
    const reclamp = () => place(chosenRef.current);
    window.addEventListener('resize', reclamp);
    // The container grows when it expands; keep its anchored edge in place and keep it on screen.
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(reclamp);
    observer?.observe(element);

    let drag:
      | { pointerId: number; x: number; y: number; from: Offset; dragging: boolean; docking: boolean }
      | undefined;
    let swallowClick = false;
    let snapTimer: number | undefined;
    const endSnap = () => {
      window.clearTimeout(snapTimer);
      element.removeAttribute('data-snapping');
    };

    const reset = () => {
      apply(ORIGIN);
      remember();
      reportMoved('reset', 'bottom');
    };

    const onPointerDown = (event: PointerEvent) => {
      const handle = event.target instanceof Element ? event.target.closest(HANDLE_SELECTOR) : null;
      if (event.button !== 0 || !handle || !element.contains(handle)) {
        return;
      }
      drag = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        from: offsetRef.current,
        dragging: false,
        docking: false,
      };
      swallowClick = false;
      handle.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.dragging && Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_THRESHOLD) {
        return;
      }
      if (!drag.dragging) {
        endSnap();
      }
      drag.dragging = true;
      element.setAttribute('data-dragging', '');
      apply({ x: drag.from.x + dx, y: drag.from.y + dy });
      const preview = dockPreviewAt(event.clientX, optionsRef.current.dockWidth);
      if (Boolean(preview) !== drag.docking) {
        drag.docking = Boolean(preview);
        setDockPreview(preview);
      }
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      if (drag.docking) {
        setDockPreview(null);
      }
      if (drag.dragging && drag.docking && event.type === 'pointerup') {
        swallowClick = true;
        optionsRef.current.onDock();
      } else if (drag.dragging) {
        // The handle's own click must not fire after a move.
        swallowClick = true;
        const snapped = snapToEdges(element, offsetRef.current);
        if (snapped.x !== offsetRef.current.x || snapped.y !== offsetRef.current.y) {
          // `data-snapping` turns the transition on just for the glide.
          element.setAttribute('data-snapping', '');
          apply(snapped);
          window.clearTimeout(snapTimer);
          snapTimer = window.setTimeout(endSnap, FLOATING_SNAP_DURATION_MS);
        }
        remember();
        reportMoved('drag', chosenRef.current.anchor);
      }
      drag = undefined;
      element.removeAttribute('data-dragging');
    };
    const onClick = (event: MouseEvent) => {
      if (swallowClick) {
        swallowClick = false;
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onDoubleClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest(HANDLE_SELECTOR)) {
        reset();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(HANDLE_SELECTOR)) {
        return;
      }
      const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
      const moves: Record<string, Offset> = {
        ArrowLeft: { x: -step, y: 0 },
        ArrowRight: { x: step, y: 0 },
        ArrowUp: { x: 0, y: -step },
        ArrowDown: { x: 0, y: step },
      };
      if (event.key === 'Home') {
        event.preventDefault();
        reset();
      } else if (moves[event.key]) {
        event.preventDefault();
        const { x, y } = offsetRef.current;
        apply({ x: x + moves[event.key].x, y: y + moves[event.key].y });
        remember();
      }
    };

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerEnd);
    element.addEventListener('pointercancel', onPointerEnd);
    element.addEventListener('click', onClick, true);
    element.addEventListener('dblclick', onDoubleClick);
    element.addEventListener('keydown', onKeyDown);
    return () => {
      endSnap();
      setDockPreview(null);
      window.removeEventListener('resize', reclamp);
      observer?.disconnect();
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerEnd);
      element.removeEventListener('pointercancel', onPointerEnd);
      element.removeEventListener('click', onClick, true);
      element.removeEventListener('dblclick', onDoubleClick);
      element.removeEventListener('keydown', onKeyDown);
    };
  }, [element, apply, place, remember]);

  return dockPreview;
}

/** Where the docked sidebar would go when the pointer is at `clientX`, or null when it is not near the right edge. */
function dockPreviewAt(clientX: number, dockWidth: number): DockPreview | null {
  const page = pageRect();
  if (clientX < page.right - DOCK_DISTANCE) {
    return null;
  }
  const width = Math.min(dockWidth, page.right - page.left);
  return { top: page.top, left: page.right - width, width, height: page.bottom - page.top };
}

/** A stored `{ x, y }` without an anchor predates top anchoring, and is an offset from the bottom centre. */
function readStoredPlacement(): Placement {
  const stored: unknown = store.getObject(OFFSET_LOCAL_STORAGE_KEY, DEFAULT_PLACEMENT);
  if (
    typeof stored === 'object' &&
    stored !== null &&
    'x' in stored &&
    'y' in stored &&
    Number.isFinite(stored.x) &&
    Number.isFinite(stored.y)
  ) {
    const anchor = 'anchor' in stored && stored.anchor === 'top' ? 'top' : 'bottom';
    return { x: Number(stored.x), y: Number(stored.y), anchor };
  }
  return DEFAULT_PLACEMENT;
}

/** The translation that puts the element, currently translated by `current`, at `placement`. */
function placementToOffset(element: HTMLElement, current: Offset, placement: Placement): Offset {
  if (placement.anchor === 'bottom') {
    return { x: placement.x, y: placement.y };
  }
  const untranslatedTop = measureWithHandles(element).top - current.y;
  return { x: placement.x, y: contentEdges().top + placement.y - untranslatedTop };
}

/** The placement of the element, translated by `current`: anchored to the edge of the page it is nearer. */
function offsetToPlacement(element: HTMLElement, current: Offset): Placement {
  const rect = measureWithHandles(element);
  const content = contentEdges();
  if (rect.top + rect.height / 2 < (content.top + content.bottom) / 2) {
    return { x: current.x, y: Math.round(rect.top - content.top), anchor: 'top' };
  }
  return { ...current, anchor: 'bottom' };
}

/**
 * The offset with each axis moved flush to the nearer edge of the page content when the element, translated
 * by `current`, is within `SNAP_DISTANCE` of it. The inset is the default place's distance from the bottom.
 */
function snapToEdges(element: HTMLElement, current: Offset): Offset {
  const rect = measureWithHandles(element);
  const left = rect.left - current.x;
  const top = rect.top - current.y;
  const content = contentEdges();
  const inset = Math.max(GUTTER, content.bottom - (top + rect.height));
  const snapAxis = (value: number, startGap: number, endGap: number, toStart: number, toEnd: number) => {
    if (Math.min(startGap, endGap) >= SNAP_DISTANCE) {
      return value;
    }
    return startGap <= endGap ? toStart : toEnd;
  };
  return {
    x: snapAxis(
      current.x,
      rect.left - content.left,
      content.right - (rect.left + rect.width),
      content.left + inset - left,
      content.right - inset - (left + rect.width)
    ),
    y: snapAxis(
      current.y,
      rect.top - content.top,
      content.bottom - (rect.top + rect.height),
      content.top + inset - top,
      content.bottom - inset - (top + rect.height)
    ),
  };
}

/**
 * Clamps `next` so the element, translated by it, stays inside the page content minus the gutter. The
 * element's untranslated position is its current one minus `current`.
 */
function clampOffset(element: HTMLElement, current: Offset, next: Offset): Offset {
  const rect = measureWithHandles(element);
  const left = rect.left - current.x;
  const top = rect.top - current.y;
  const content = contentEdges();
  const bounds = {
    left: content.left + GUTTER,
    top: content.top + GUTTER,
    right: content.right - GUTTER,
    bottom: content.bottom - GUTTER,
  };
  // The ranges always include the origin, so the default corner is always allowed.
  const clampAxis = (value: number, low: number, high: number) => {
    const clamped = Math.round(Math.min(Math.max(value, Math.min(low, 0)), Math.max(high, 0)));
    // Without a measurable box (not laid out yet) the corner is the only safe place.
    return Number.isFinite(clamped) ? clamped : 0;
  };
  return {
    x: clampAxis(next.x, bounds.left - left, bounds.right - (left + rect.width)),
    y: clampAxis(next.y, bounds.top - top, bounds.bottom - (top + rect.height)),
  };
}

/**
 * The page content's edges, or the window's when the page has no content element. The content element
 * reserves the docked menu as padding, so its padding box would put the container over the menu.
 */
function contentEdges(): { left: number; top: number; right: number; bottom: number } {
  const element = document.getElementById('pageContent');
  if (!element) {
    return pageRect();
  }
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  const padding = (value: string) => parseFloat(value) || 0;
  return {
    left: rect.left + padding(style.paddingLeft),
    top: rect.top + padding(style.paddingTop),
    right: rect.left + rect.width - padding(style.paddingRight),
    bottom: rect.top + rect.height - padding(style.paddingBottom),
  };
}

/** The page content's border box, or the window's when the page has no content element. */
function pageRect(): { left: number; top: number; right: number; bottom: number } {
  const element = document.getElementById('pageContent');
  if (!element) {
    return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  }
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, right: left + width, bottom: top + height };
}

/**
 * The element's box grown to include its drag handles: a handle may sit outside the element's edge (a flag
 * on its side), and it must stay on the page too.
 */
function measureWithHandles(element: HTMLElement): { left: number; top: number; width: number; height: number } {
  const rects = [element, ...element.querySelectorAll<HTMLElement>(HANDLE_SELECTOR)].map((node) =>
    node.getBoundingClientRect()
  );
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.left + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.top + rect.height));
  return { left, top, width: right - left, height: bottom - top };
}

function isOrigin({ x, y }: Offset): boolean {
  return x === 0 && y === 0;
}
