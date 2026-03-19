/**
 * Cursor sharing utilities — throttling, coordinate conversion, staleness.
 */

/** Throttle a function to fire at most once per `ms` milliseconds. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic throttle needs flexible parameter types
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

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- throttled wrapper preserves the original function signature
  return throttled as unknown as T;
}

/** Convert absolute pixel position to viewport-relative percentage (0-100). */
export function toViewportPercent(
  clientX: number,
  clientY: number,
  container: HTMLElement
): { x: number; y: number } {
  const rect = container.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 100;
  const y = ((clientY - rect.top) / rect.height) * 100;
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
