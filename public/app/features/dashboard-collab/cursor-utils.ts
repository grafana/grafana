/**
 * Cursor sharing utilities — throttling, coordinate conversion, staleness.
 */

/** Throttle a function to fire at most once per `ms` milliseconds. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const throttled = (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = ms - (now - lastCall);

    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastCall = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  };

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return throttled as unknown as T;
}

/**
 * Convert absolute pixel position to canvas-relative percentage (0–100).
 *
 * Coordinates are relative to the full scrollable content of `canvas`, not
 * just the visible viewport. This means a cursor halfway down a tall
 * dashboard will have y≈50 regardless of scroll position, and remote users
 * with different window sizes will see the cursor at the same panel position.
 */
export function toViewportPercent(
  clientX: number,
  clientY: number,
  canvas: HTMLElement
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  // Position within the visible area, then add scroll offset to get the
  // position within the full scrollable content.
  const xPx = clientX - rect.left + canvas.scrollLeft;
  const yPx = clientY - rect.top + canvas.scrollTop;
  // Use scrollWidth/scrollHeight as the basis so percentages are stable
  // across different window sizes / scroll positions.
  const x = (xPx / canvas.scrollWidth) * 100;
  const y = (yPx / canvas.scrollHeight) * 100;
  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

/** Convert viewport-relative percentage back to CSS position values. */
export function fromViewportPercent(
  x: number,
  y: number
): { left: string; top: string } {
  return { left: `${x}%`, top: `${y}%` };
}

/** Cursor send rate: 10Hz = 100ms between sends. */
export const CURSOR_THROTTLE_MS = 100;

/** Name label fades after this many ms. */
export const LABEL_FADE_MS = 3000;

/** Remove cursors not updated in this many ms. */
export const STALE_CURSOR_MS = 5000;
