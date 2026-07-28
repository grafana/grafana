// Minimal PromQL helpers for the keyboard-popover prototype. Not a real
// parser — just enough to (a) syntax-highlight metric names, (b) snap a text
// selection to the enclosing range-function call, and (c) apply scripted swaps.

// Metric names in the demo queries. Only these get colored in the editor, so
// labels like `path` / `service_name` stay the default text color (matching
// the Figma screens, which highlight only metric identifiers).
const METRIC_RE = /server_requests?_duration_seconds(?:_sum|_count|_bucket|_max)?|server_requests_total|\bup\b/g;

export interface HighlightSegment {
  text: string;
  metric: boolean;
}

/** Split raw query into segments so metric names can be rendered in blue. */
export function highlightSegments(raw: string): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  let last = 0;
  METRIC_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = METRIC_RE.exec(raw)) !== null) {
    if (m.index > last) {
      segments.push({ text: raw.slice(last, m.index), metric: false });
    }
    segments.push({ text: m[0], metric: true });
    last = m.index + m[0].length;
  }
  if (last < raw.length) {
    segments.push({ text: raw.slice(last), metric: false });
  }
  return segments;
}

const RANGE_FN_RE = /\b(rate|irate|increase|delta)\s*\(/g;

function matchingParen(raw: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < raw.length; i++) {
    if (raw[i] === '(') {
      depth++;
    } else if (raw[i] === ')') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return raw.length - 1;
}

export interface Section {
  start: number;
  end: number;
  fn: { name: string; start: number; end: number };
  metric: { text: string; start: number; end: number } | null;
  range: { text: string; start: number; end: number } | null;
}

/**
 * Finds the range-function call (rate/irate/…) that the selection falls in or
 * nearest to, and locates its function name, metric, and [window] so a swap can
 * target a coherent span.
 */
export function analyzeSection(raw: string, selStart: number, selEnd: number): Section | null {
  const lo = Math.min(selStart, selEnd);
  const hi = Math.max(selStart, selEnd);
  const mid = (lo + hi) / 2;

  RANGE_FN_RE.lastIndex = 0;
  const groups: Section[] = [];
  let m: RegExpExecArray | null;
  while ((m = RANGE_FN_RE.exec(raw)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = matchingParen(raw, open);
    const inner = raw.slice(m.index, close + 1);

    let metric: Section['metric'] = null;
    // The last alternative is the scripted typo (missing i in "duration") — it
    // has to be recognized as the metric so the "fix error" flow can target it.
    const met = inner.match(
      /server_requests?_duration_seconds(?:_sum|_count|_bucket|_max)?|server_requests_total|server_requests_duraton_seconds_sum/
    );
    if (met && met.index !== undefined) {
      metric = { text: met[0], start: m.index + met.index, end: m.index + met.index + met[0].length };
    }
    let range: Section['range'] = null;
    const rng = inner.match(/\[[^\]]+\]/);
    if (rng && rng.index !== undefined) {
      range = { text: rng[0], start: m.index + rng.index, end: m.index + rng.index + rng[0].length };
    }

    groups.push({
      start: m.index,
      end: close + 1,
      fn: { name: m[1], start: m.index, end: m.index + m[1].length },
      metric,
      range,
    });
  }

  if (groups.length === 0) {
    return null;
  }
  // Prefer a group the selection overlaps; else the closest one.
  const overlapping = groups.find((g) => g.end > lo && g.start < hi);
  if (overlapping) {
    return overlapping;
  }
  return groups.reduce((best, g) =>
    Math.abs((g.start + g.end) / 2 - mid) < Math.abs((best.start + best.end) / 2 - mid) ? g : best
  );
}

export function splice(raw: string, start: number, end: number, replacement: string): string {
  return raw.slice(0, start) + replacement + raw.slice(end);
}

export function applySwapFunction(raw: string, section: Section, fnName: string): string {
  return splice(raw, section.fn.start, section.fn.end, fnName);
}

export function applySwapMetric(raw: string, section: Section, metric: string): string {
  if (!section.metric) {
    return raw;
  }
  return splice(raw, section.metric.start, section.metric.end, metric);
}

export function applyChangeWindow(raw: string, section: Section, window: string): string {
  if (!section.range) {
    return raw;
  }
  return splice(raw, section.range.start, section.range.end, window);
}
