import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Put this attribute on an element inside the floating extension sidebar to make it the handle that moves
 * the floating container (pointer drag, arrow keys, Home or double-click to reset).
 */
export const FLOATING_DRAG_HANDLE_ATTRIBUTE = 'data-extension-floating-drag-handle';

const HANDLE_SELECTOR = `[${FLOATING_DRAG_HANDLE_ATTRIBUTE}]`;
/** Space kept between the floating container and the edges of the page content. */
const GUTTER = 24;
/** A press that moves less than this is a click on the handle, not a drag. */
const DRAG_THRESHOLD = 4;
const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;

interface Offset {
  x: number;
  y: number;
}

const ORIGIN: Offset = { x: 0, y: 0 };

/**
 * Moves the floating extension sidebar away from its bottom-right corner, for the current floating session
 * only: it always starts in the corner. The offset is a translation of `element` from that corner, kept
 * fully inside the page content (with a gutter), and re-clamped when the window or the element resizes.
 * Returns whether it is moved, so the page inset can be dropped while the sidebar is not at the bottom.
 */
export function useFloatingDrag(element: HTMLElement | null): { moved: boolean } {
  const offsetRef = useRef<Offset>(ORIGIN);
  const [moved, setMoved] = useState(false);

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

  // Floating starts in the corner, and docking (the element going away) puts it back there.
  useLayoutEffect(() => {
    if (!element) {
      return;
    }
    apply(ORIGIN);
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
    const reclamp = () => apply(offsetRef.current);
    window.addEventListener('resize', reclamp);
    // The container grows upward when it expands; keep it on screen.
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(reclamp);
    observer?.observe(element);

    let drag: { pointerId: number; x: number; y: number; from: Offset; dragging: boolean } | undefined;
    let swallowClick = false;

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
      } else if (moves[event.key]) {
        event.preventDefault();
        const { x, y } = offsetRef.current;
        apply({ x: x + moves[event.key].x, y: y + moves[event.key].y });
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
  }, [element, apply]);

  return { moved };
}

/**
 * Clamps `next` so the element, translated by it, stays inside the page content minus the gutter. The
 * element's untranslated position is its current one minus `current`.
 */
function clampOffset(element: HTMLElement, current: Offset, next: Offset): Offset {
  const rect = measureWithHandles(element);
  const left = rect.left - current.x;
  const top = rect.top - current.y;
  const content = document.getElementById('pageContent')?.getBoundingClientRect();
  const bounds = {
    left: (content?.left ?? 0) + GUTTER,
    top: (content?.top ?? 0) + GUTTER,
    right: (content ? content.left + content.width : window.innerWidth) - GUTTER,
    bottom: (content ? content.top + content.height : window.innerHeight) - GUTTER,
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
