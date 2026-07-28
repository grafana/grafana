// Scripted content for the updated highlight flow (v2). All mocked.
//
// The original highlight flow (FLOW1 + KeyboardQueryPane) is left untouched so
// the two can be compared side by side; this file only feeds the v2 pane.

import { TOPK_QUERY, type PreviewSegment, type Suggestion } from './flows';
import { analyzeSection, splice, type Section } from './tokens';

/** Shown in the selection toolbar. cmd+/ (ctrl+/ off Mac) opens Coauthor. */
export const COAUTHOR_KEYS = ['cmd', '/'];

export function isCoauthorShortcut(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && !e.altKey && e.key === '/';
}

/** A node in the non-AI query map. `selected` marks the highlighted section. */
export interface MapNode {
  category: string;
  value: string;
  selected?: boolean;
  /** The node references something that can't be resolved. */
  error?: boolean;
  /** Shown as a third row on hover. Kept to a handful of words. */
  hint: string;
}

/** A node in the popover's small flow viz. A null value renders as a placeholder. */
export interface BuildNode {
  category: string;
  value: string | null;
  changed?: boolean;
}

/** One scripted suggestion: what it edits, why, and how it animates in. */
export interface V2Change {
  op: V2Op;
  why: string;
  building: BuildNode[];
  result: BuildNode[];
}

export interface V2Op {
  kind: 'function' | 'metric' | 'window';
  value: string;
}

const SHORT_METRIC = 'server_requests_duration...';

function shortMetric(text: string | undefined): string {
  if (!text) {
    return SHORT_METRIC;
  }
  return text.length > 27 ? `${text.slice(0, 24)}...` : text;
}

/** `rate` + `[5m]` → "rate 5m", the label used in every flow viz. */
function fnLabel(section: Section | null): string {
  if (!section) {
    return 'rate 5m';
  }
  const win = section.range?.text.replace(/[[\]]/g, '') ?? '';
  return `${section.fn.name} ${win}`.trim();
}

/**
 * The whole query as a left-to-right map. Only the nodes that belong to the
 * highlighted section are marked `selected`, so the map shows where the
 * selection sits in the query rather than replacing it.
 */
export function buildQueryMap(section: Section | null): MapNode[] {
  const metric = section?.metric?.text;
  // Without a resolvable metric the map can't claim to know what kind it is.
  const badMetric = metric === TYPO_METRIC;
  const win = section?.range?.text.replace(/[[\]]/g, '') ?? '5m';
  const fnHints: Record<string, string> = {
    rate: `Per-second average over ${win}`,
    irate: `Per-second from last two samples`,
    increase: `Total increase over ${win}`,
    delta: `Change over ${win}`,
  };
  return [
    {
      category: badMetric ? 'UNKNOWN METRIC' : 'COUNTER',
      value: shortMetric(metric),
      selected: true,
      error: badMetric,
      hint: badMetric ? 'Not a metric on this datasource' : 'Ever-growing total of request time',
    },
    {
      category: 'FUNCTION',
      value: fnLabel(section),
      selected: true,
      hint: fnHints[section?.fn.name ?? 'rate'] ?? `Applied over ${win}`,
    },
    { category: 'FUNCTION', value: 'sum by(path, service_name)', hint: 'Totals grouped by path and service' },
    { category: 'FUNCTION', value: '÷ count → avg', hint: 'Divides by count for average' },
    { category: 'FUNCTION', value: 'topk 5', hint: 'Keeps the five highest series' },
  ];
}

export const V2_LOOKS_LIKE = 'Total request time, per second, over the last 5 min';

// ---- Typo scenario -------------------------------------------------------
const GOOD_METRIC = 'server_requests_duration_seconds_sum';
/** Misspelled "duration" — the editor squiggles it and "Fix error" repairs it. */
export const TYPO_METRIC = 'server_requests_duraton_seconds_sum';
export const TYPO_QUERY = TOPK_QUERY.replace(GOOD_METRIC, TYPO_METRIC);

export const V2_LOOKS_LIKE_TYPO = `Total request time, per second — but ${TYPO_METRIC} isn't a metric on this datasource`;

export const V2_FIX_TYPO: V2Change = {
  op: { kind: 'metric', value: GOOD_METRIC },
  why: `${TYPO_METRIC} doesn't exist on this datasource. The closest match is ${GOOD_METRIC} — "duration" was missing an i.`,
  building: [
    { category: 'FUNCTION', value: 'rate 5m' },
    { category: 'METRIC', value: null },
  ],
  result: [
    { category: 'FUNCTION', value: 'rate 5m' },
    { category: 'COUNTER', value: SHORT_METRIC, changed: true },
  ],
};

// ---- The two scripted rounds of the demo --------------------------------
// Round 1: "smooth this out so it's less jumpy" → widen the window.
export const V2_SMOOTH: V2Change = {
  op: { kind: 'window', value: '[15m]' },
  why: 'Increasing the window to 15m will smooth out the rate function.',
  building: [
    { category: 'FUNCTION', value: null },
    { category: 'COUNTER', value: SHORT_METRIC },
  ],
  result: [
    { category: 'FUNCTION', value: 'rate 15m', changed: true },
    { category: 'COUNTER', value: SHORT_METRIC },
  ],
};

// Round 2: "can you use max instead of adding them all up" → swap the metric,
// keeping round 1's window.
export const V2_MAX: V2Change = {
  op: { kind: 'metric', value: 'server_requests_duration_seconds_max' },
  why: 'Using the max metric here shows the highest request duration instead of the total.',
  building: [
    { category: 'FUNCTION', value: 'rate 15m' },
    { category: 'METRIC', value: null },
  ],
  result: [
    { category: 'FUNCTION', value: 'rate 15m', changed: true },
    { category: 'COUNTER', value: SHORT_METRIC },
  ],
};

export const V2_OUT_OF_SCOPE = {
  body: 'Your changes may need to span across other datasource or additional queries outside of the one we are focused on. Continue in Workspace to make larger changes.',
  note: 'Any unsaved panel edits will not be lost.',
};

// Asks that can't land in one query on one datasource: a panel per service,
// several queries, another datasource, a whole dashboard.
const OUT_OF_SCOPE = [
  /(every|each|per) (service|instance|pod|host|team|endpoint)/,
  /(own|separate|individual) (graph|panel|chart|row|query|queries)/,
  /(multiple|several|two|more) (quer(y|ies)|panels|graphs|charts)/,
  /(another|different|other|second|new) (datasource|data source)/,
  /\b(loki|logs|traces|tempo|pyroscope|profiles|mysql|postgres)\b/,
  /(new|whole|entire) dashboard/,
  /split (this|it|them)/,
];

/** True when the prompt needs more than the one query we're focused on. */
export function isOutOfScope(text: string): boolean {
  const t = text.toLowerCase();
  return OUT_OF_SCOPE.some((re) => re.test(t));
}

/**
 * Maps a free-text prompt onto one of the scripted changes. Falls back to the
 * change that fits where the user is in the demo, so a prompt phrased any which
 * way still moves the story forward.
 */
export function interpretV2(text: string, round: number, section: Section | null): V2Change {
  const t = text.toLowerCase();
  if (/max|highest|peak|slowest|instead of adding|not the total|not a total/.test(t)) {
    return V2_MAX;
  }
  if (/irate|spike|debug/.test(t)) {
    return changeForSuggestion('function', { name: 'irate', desc: '' }, section);
  }
  if (/increase|total over/.test(t)) {
    return changeForSuggestion('function', { name: 'increase', desc: '' }, section);
  }
  if (/smooth|jump|noisy|noise|window|15m|steadier/.test(t)) {
    return V2_SMOOTH;
  }
  return round === 0 ? V2_SMOOTH : V2_MAX;
}

const FUNCTION_WHY: Record<string, string> = {
  irate: 'irate only uses the last two samples, so short spikes stay visible instead of averaging away.',
  increase: 'increase reports the total over the window instead of an ongoing per-second rate.',
};

const WINDOW_WHY: Record<string, string> = {
  '[1m]': 'A 1m window reacts faster to change, at the cost of a noisier line.',
  '[15m]': 'Increasing the window to 15m will smooth out the rate function.',
};

/** Picking a suggestion from a chip runs the same build → result path. */
export function changeForSuggestion(kind: 'function' | 'window', s: Suggestion, section: Section | null): V2Change {
  const metric = shortMetric(section?.metric?.text);
  if (kind === 'function') {
    return {
      op: { kind: 'function', value: s.name },
      why: FUNCTION_WHY[s.name] ?? `Swaps the range function to ${s.name}.`,
      building: [
        { category: 'FUNCTION', value: null },
        { category: 'COUNTER', value: metric },
      ],
      result: [
        {
          category: 'FUNCTION',
          value: `${s.name} ${section?.range?.text.replace(/[[\]]/g, '') ?? ''}`.trim(),
          changed: true,
        },
        { category: 'COUNTER', value: metric },
      ],
    };
  }
  const win = s.name.match(/\[[^\]]+\]/)?.[0] ?? s.name;
  return {
    op: { kind: 'window', value: win },
    why: WINDOW_WHY[win] ?? `Changes the range window to ${win}.`,
    building: [
      { category: 'FUNCTION', value: null },
      { category: 'COUNTER', value: metric },
    ],
    result: [
      { category: 'FUNCTION', value: `${section?.fn.name ?? 'rate'} ${win.replace(/[[\]]/g, '')}`, changed: true },
      { category: 'COUNTER', value: metric },
    ],
  };
}

// ---- Applying pending (not yet accepted) edits ---------------------------
export interface Range {
  start: number;
  end: number;
}

/**
 * Applies the pending ops to `base` and reports where each landed, so the
 * editor can paint them as "proposed". `anchor` is an offset inside the section
 * being edited — the ops all target the same range-function call, whose start
 * never moves, so one anchor stays valid across ops.
 */
export function applyOps(base: string, anchor: number, ops: V2Op[]): { text: string; ranges: Range[] } {
  let text = base;
  const ranges: Range[] = [];
  for (const op of ops) {
    const section = analyzeSection(text, anchor, anchor);
    const target =
      section && (op.kind === 'function' ? section.fn : op.kind === 'metric' ? section.metric : section.range);
    if (!target) {
      continue;
    }
    text = splice(text, target.start, target.end, op.value);
    const delta = op.value.length - (target.end - target.start);
    for (let i = ranges.length - 1; i >= 0; i--) {
      const r = ranges[i];
      if (r.start >= target.end) {
        r.start += delta;
        r.end += delta;
      } else if (r.end > target.start) {
        // A later op editing the same span supersedes the earlier mark, so the
        // spans stay disjoint.
        ranges.splice(i, 1);
      }
    }
    ranges.push({ start: target.start, end: target.start + op.value.length });
  }
  return { text, ranges };
}

/** Splits text so the pending ranges render in the "proposed" blue. */
export function previewFromRanges(text: string, ranges: Range[]): PreviewSegment[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: PreviewSegment[] = [];
  let cursor = 0;
  for (const r of sorted) {
    // Defensive: never emit a span twice if two marks somehow overlap.
    if (r.end <= cursor) {
      continue;
    }
    if (r.start > cursor) {
      out.push({ text: text.slice(cursor, r.start), proposed: false });
    }
    out.push({ text: text.slice(r.start, r.end), proposed: true, tone: 'blue' });
    cursor = r.end;
  }
  if (cursor < text.length) {
    out.push({ text: text.slice(cursor), proposed: false });
  }
  return out;
}
