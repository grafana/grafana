import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { store } from '@grafana/data';

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
const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;
/** How long the container glides to its snap point after a drag; ExtensionSidebar's transition uses it too. */
export const FLOATING_SNAP_DURATION_MS = 150;
const OFFSET_LOCAL_STORAGE_KEY = 'grafana.navigation.extensionSidebarFloatingOffset';

interface Offset {
  x: number;
  y: number;
}

const ORIGIN: Offset = { x: 0, y: 0 };

/**
 * Moves the floating extension sidebar away from its default place at the bottom centre. The offset is a
 * translation of `element` from that place, kept fully inside the page content (with a gutter), and
 * re-clamped when the window or the element resizes. A pointer drag follows the pointer freely, then snaps
 * on release to the nearest corner of the page content or its top or bottom centre; the arrow keys move in
 * steps without snapping. The user's chosen offset is remembered in local storage, so floating again, or a
 * reload, puts it back; a re-clamp never overwrites it, so it returns once there is room.
 * Returns whether it is moved away from its default place.
 */
export function useFloatingDrag(element: HTMLElement | null): { moved: boolean } {
  const offsetRef = useRef<Offset>(ORIGIN);
  const chosenRef = useRef<Offset>(ORIGIN);
  const [moved, setMoved] = useState(false);

  const remember = useCallback(() => {
    chosenRef.current = offsetRef.current;
    if (isOrigin(offsetRef.current)) {
      store.delete(OFFSET_LOCAL_STORAGE_KEY);
    } else {
      store.setObject(OFFSET_LOCAL_STORAGE_KEY, offsetRef.current);
    }
  }, []);

  const apply = useCallback(
    (next: Offset) => {
      if (!element) {
        return;
      }
      const clamped = clampOffset(element, offsetRef.current, next);
      offsetRef.current = clamped;
      element.style.transform = isOrigin(clamped) ? '' : `translate(${clamped.x}px, ${clamped.y}px)`;
      setMoved(!isOrigin(clamped));
    },
    [element]
  );

  // Floating starts where the user left it; docking (the element going away) only clears the transform.
  useLayoutEffect(() => {
    if (!element) {
      return;
    }
    chosenRef.current = readStoredOffset();
    apply(chosenRef.current);
    return () => {
      offsetRef.current = ORIGIN;
      element.style.transform = '';
      setMoved(false);
    };
  }, [element, apply]);

  useEffect(() => {
    if (!element) {
      return;
    }
    const reclamp = () => apply(chosenRef.current);
    window.addEventListener('resize', reclamp);
    // The container grows upward when it expands; keep it on screen.
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(reclamp);
    observer?.observe(element);

    let drag: { pointerId: number; x: number; y: number; from: Offset; dragging: boolean } | undefined;
    let swallowClick = false;
    let snapTimer: number | undefined;
    const endSnap = () => {
      window.clearTimeout(snapTimer);
      element.removeAttribute('data-snapping');
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
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      if (drag.dragging) {
        // The handle's own click must not fire after a move.
        swallowClick = true;
        // Let go, it glides to the nearest snap point; `data-snapping` turns the transition on just for that.
        element.setAttribute('data-snapping', '');
        apply(snapOffset(element, offsetRef.current));
        remember();
        window.clearTimeout(snapTimer);
        snapTimer = window.setTimeout(endSnap, FLOATING_SNAP_DURATION_MS);
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
        apply(ORIGIN);
        remember();
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
        apply(ORIGIN);
        remember();
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
  }, [element, apply, remember]);

  return { moved };
}

function readStoredOffset(): Offset {
  const stored: unknown = store.getObject(OFFSET_LOCAL_STORAGE_KEY, ORIGIN);
  if (
    typeof stored === 'object' &&
    stored !== null &&
    'x' in stored &&
    'y' in stored &&
    Number.isFinite(stored.x) &&
    Number.isFinite(stored.y)
  ) {
    return { x: Number(stored.x), y: Number(stored.y) };
  }
  return ORIGIN;
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
 * The snap point nearest `current`: a corner of the page content, or its top or bottom centre. The default
 * place is the bottom centre, so the bottom row and the centre column keep its offset, and every other point
 * keeps its inset from the bottom edge, from the side and top edges instead. The result still goes through
 * the clamp, which keeps a point the page has no room for on the page.
 */
function snapOffset(element: HTMLElement, current: Offset): Offset {
  const rect = measureWithHandles(element);
  const left = rect.left - current.x;
  const top = rect.top - current.y;
  const content = contentEdges();
  const inset = Math.max(GUTTER, content.bottom - (top + rect.height));
  const start = content.left + inset - left;
  const end = content.right - inset - (left + rect.width);
  const above = content.top + inset - top;
  const points: Offset[] = [
    { x: start, y: above },
    { x: 0, y: above },
    { x: end, y: above },
    { x: start, y: 0 },
    ORIGIN,
    { x: end, y: 0 },
  ];
  const distance = (point: Offset) => (point.x - current.x) ** 2 + (point.y - current.y) ** 2;
  return points.reduce((nearest, point) => (distance(point) < distance(nearest) ? point : nearest));
}

/**
 * The page content's edges, or the window's when the page has no content element. The content element
 * reserves the docked menu as padding, so its padding box would put the container over the menu.
 */
function contentEdges(): { left: number; top: number; right: number; bottom: number } {
  const element = document.getElementById('pageContent');
  if (!element) {
    return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
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
