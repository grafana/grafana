/**
 * Pure time-range math for the time navigator.
 *
 * Everything here is a pure function of its arguments — no React, no uPlot, no DOM, no `Date.now()`.
 * All ranges are absolute, in epoch **milliseconds**, with `from <= to`. This is the layer that used to
 * be inline magic numbers and unclamped arithmetic scattered through `SimplePanel.tsx`.
 */

/** An absolute time range in epoch milliseconds. */
export interface TimeRangeMs {
  from: number;
  to: number;
}

/** Context window span = selection span * this factor (was the magic `* 8`). */
export const CONTEXT_ZOOM_FACTOR = 8;
/** Never allow a range narrower than this; prevents zero/negative spans and divide-by-zero. */
const MIN_SPAN_MS = 1000;
/** A wheel step scales the span by this (up) or its reciprocal (down). Was `zoomBase = 0.8`. */
export const WHEEL_ZOOM_BASE = 0.8;
/** Pan buttons move the window by this fraction of its span. */
const PAN_STEP_FRACTION = 0.25;
/** Ranges within this many ms of each other are treated as equal (dashboard echo detection). */
const DASHBOARD_SYNC_TOLERANCE_MS = 1000;

function spanOf(r: TimeRangeMs): number {
  return r.to - r.from;
}

export function midOf(r: TimeRangeMs): number {
  return (r.from + r.to) / 2;
}

/** True when two ranges are equal within `tol` ms on both ends. */
export function approxEqual(a: TimeRangeMs, b: TimeRangeMs, tol = DASHBOARD_SYNC_TOLERANCE_MS): boolean {
  return Math.abs(a.from - b.from) < tol && Math.abs(a.to - b.to) < tol;
}

export interface ClampOptions {
  /** Minimum allowed span; the range is widened around its midpoint if narrower. */
  minSpanMs?: number;
  /** Upper bound for `to`; the whole window is shifted back (span preserved) if it would exceed this. */
  maxTo?: number;
}

/**
 * Normalise a range: order the ends, enforce a minimum span, and optionally clamp so `to <= maxTo`.
 * Returns the input unchanged if either end is non-finite (defensive; callers should pass numbers).
 */
export function clampRange(range: TimeRangeMs, opts: ClampOptions = {}): TimeRangeMs {
  let { from, to } = range;
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return range;
  }
  if (from > to) {
    [from, to] = [to, from];
  }
  const minSpan = opts.minSpanMs ?? MIN_SPAN_MS;
  if (to - from < minSpan) {
    const mid = (from + to) / 2;
    from = mid - minSpan / 2;
    to = mid + minSpan / 2;
  }
  if (opts.maxTo != null && to > opts.maxTo) {
    const shift = to - opts.maxTo;
    from -= shift;
    to = opts.maxTo;
  }
  return { from, to };
}

/**
 * The default context window for a given selection: centred on the selection, `factor`× wider, but never
 * extending past `now` (shifted back if it would). This is the "reset"/initial view.
 * The selection span is floored at MIN_SPAN_MS first, so sub-second selections still yield a usable window.
 */
export function computeContextWindow(selection: TimeRangeMs, now: number, factor = CONTEXT_ZOOM_FACTOR): TimeRangeMs {
  const mid = midOf(selection);
  const span = Math.max(spanOf(selection), MIN_SPAN_MS);
  const zoomSpan = span * factor;
  let from = mid - zoomSpan / 2;
  let to = mid + zoomSpan / 2;
  if (to > now) {
    from -= to - now;
    to = now;
  }
  return { from, to };
}

/** Shift a range left or right by `fraction` of its span. */
export function panRange(range: TimeRangeMs, direction: 'left' | 'right', fraction = PAN_STEP_FRACTION): TimeRangeMs {
  const delta = spanOf(range) * fraction * (direction === 'left' ? -1 : 1);
  return { from: range.from + delta, to: range.to + delta };
}

/**
 * A context window that extends `extraMs` on each side of a base (dashboard) range, capped at `now`.
 * Used by the popover's relative presets (e.g. "Last 1 week" around the current dashboard range).
 */
export function extendedContext(base: TimeRangeMs, extraMs: number, now: number): TimeRangeMs {
  return {
    from: base.from - extraMs,
    to: Math.min(base.to + extraMs, now),
  };
}
