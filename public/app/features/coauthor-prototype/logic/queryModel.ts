// Core (mocked) query "understanding" for the coauthor-mode prototype.
//
// Nothing here is a real PromQL parser or executor — it is a set of
// heuristics tuned to the one running example in the prototype plan
// (server_requests_duration_seconds / checkout scenario). The point is
// that the *interaction* and UI states are real even though the query
// intelligence is scripted.

/** The semantic role of a chip drives both its color and its explanation. */
export type ChipRole =
  | 'transform' // topk, histogram_quantile
  | 'aggregation' // sum by(...), avg by(...)
  | 'function' // rate, irate, increase
  | 'metric' // a metric selector, optionally with {label matchers}
  | 'range' // [5m]
  | 'operator' // / * + -
  | 'plain'; // punctuation / numbers / whitespace — structural, not selectable

export interface Chip {
  id: string;
  role: ChipRole;
  text: string;
  /** Whitespace/punctuation is rendered but can't be the target of explain/modify. */
  selectable: boolean;
}

export interface LabelFilter {
  label: string;
  op: string;
  value: string;
}

export interface QueryFeatures {
  metricBase: string;
  mode: 'average' | 'p95' | 'raw';
  percentile: number;
  topk: number | null;
  range: { num: number; unit: string } | null;
  groupBy: string[];
  filters: LabelFilter[];
}

export interface FlowNode {
  role: ChipRole;
  text: string;
  caption?: string;
}

export interface QueryFlow {
  branches: FlowNode[][];
  merge: FlowNode[];
}

export interface Understanding {
  features: QueryFeatures;
  sentence: string;
  flow: QueryFlow;
  why: string;
}

export interface ModifyResult {
  newRaw: string;
  /** 0–100. "How closely this matches what you asked for." */
  confidence: number;
  kind: 'filter' | 'p95' | 'errors' | 'build' | 'unknown';
  note: string;
  /** Short label used in the suggestion chips. */
  label: string;
}

export const BASE_QUERY =
  'topk(5, sum by(path, service_name) (rate(server_requests_duration_seconds_sum[5m])) / sum by(path, service_name) (rate(server_requests_duration_seconds_count[5m])))';

export const MOCK_DATASOURCE = {
  name: 'grafanacloud-dev-prom',
  type: 'prometheus',
  metrics: [
    { name: 'server_requests_duration_seconds', type: 'histogram' },
    { name: 'server_requests_total', type: 'counter' },
    { name: 'up', type: 'gauge' },
  ],
  labels: ['path', 'service_name', 'status_code'],
  values: {
    path: ['/checkout', '/cart', '/login', '/search', '/profile'],
    service_name: ['checkout-service', 'auth-service', 'search-service'],
    status_code: ['200', '301', '404', '500', '503'],
  },
};

const TRANSFORM_FNS = ['topk', 'bottomk', 'histogram_quantile', 'quantile'];
const AGG_FNS = ['sum', 'avg', 'min', 'max', 'count', 'stddev', 'stdvar', 'group'];
const RANGE_FNS = ['rate', 'irate', 'increase', 'delta', 'idelta', 'deriv'];

const isIdentStart = (c: string) => /[A-Za-z_:]/.test(c);
const isIdent = (c: string) => /[A-Za-z0-9_:]/.test(c);

/**
 * Loss-less tokenizer: `tokenize(raw).map(c => c.text).join('')` always
 * reconstructs `raw`, which lets manual edits round-trip cleanly.
 */
export function tokenize(raw: string): Chip[] {
  const chips: Chip[] = [];
  let i = 0;
  const push = (role: ChipRole, text: string, selectable = true) =>
    chips.push({ role, text, selectable, id: String(chips.length) });

  while (i < raw.length) {
    const c = raw[i];

    if (/\s/.test(c)) {
      let j = i;
      while (j < raw.length && /\s/.test(raw[j])) {
        j++;
      }
      push('plain', raw.slice(i, j), false);
      i = j;
      continue;
    }

    if (c === '[') {
      let j = raw.indexOf(']', i);
      if (j === -1) {
        j = raw.length - 1;
      }
      push('range', raw.slice(i, j + 1));
      i = j + 1;
      continue;
    }

    if ('/*+'.includes(c) || (c === '-' && !/[0-9]/.test(raw[i + 1] ?? ''))) {
      push('operator', c);
      i++;
      continue;
    }

    if ('(),'.includes(c)) {
      push('plain', c, false);
      i++;
      continue;
    }

    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < raw.length && /[0-9.eE]/.test(raw[j])) {
        j++;
      }
      push('plain', raw.slice(i, j), false);
      i = j;
      continue;
    }

    if (isIdentStart(c)) {
      let j = i;
      while (j < raw.length && isIdent(raw[j])) {
        j++;
      }
      const word = raw.slice(i, j);
      const lower = word.toLowerCase();

      if (AGG_FNS.includes(lower)) {
        // Fold an optional "by(...)" / "without(...)" grouping into the chip.
        let k = j;
        while (k < raw.length && /\s/.test(raw[k])) {
          k++;
        }
        const rest = raw.slice(k).toLowerCase();
        const kw = rest.startsWith('by') ? 2 : rest.startsWith('without') ? 7 : 0;
        if (kw) {
          let p = k + kw;
          while (p < raw.length && /\s/.test(raw[p])) {
            p++;
          }
          if (raw[p] === '(') {
            const close = raw.indexOf(')', p);
            if (close !== -1) {
              push('aggregation', raw.slice(i, close + 1));
              i = close + 1;
              continue;
            }
          }
        }
        push('aggregation', word);
        i = j;
        continue;
      }

      if (TRANSFORM_FNS.includes(lower)) {
        push('transform', word);
        i = j;
        continue;
      }

      if (RANGE_FNS.includes(lower)) {
        push('function', word);
        i = j;
        continue;
      }

      // Otherwise it's a metric selector, possibly with a {label matcher}.
      if (raw[j] === '{') {
        const close = raw.indexOf('}', j);
        if (close !== -1) {
          push('metric', raw.slice(i, close + 1));
          i = close + 1;
          continue;
        }
      }
      push('metric', word);
      i = j;
      continue;
    }

    push('plain', c, false);
    i++;
  }

  return chips;
}

export interface SnappedRange {
  chips: Chip[];
  start: number;
  end: number;
}

/**
 * Snaps an arbitrary character selection to complete token boundaries so that
 * "explain" and "modify" always operate on a semantically coherent span.
 */
export function snapRange(raw: string, selStart: number, selEnd: number): SnappedRange {
  const chips = tokenize(raw);
  let offset = 0;
  const spans = chips.map((chip) => {
    const start = offset;
    offset += chip.text.length;
    return { chip, start, end: offset };
  });

  const lo = Math.min(selStart, selEnd);
  const hi = Math.max(selStart, selEnd);
  const overlap = spans.filter((s) => s.chip.selectable && s.end > lo && s.start < Math.max(hi, lo + 1));

  if (overlap.length === 0) {
    const at = spans.find((s) => s.chip.selectable && s.start <= lo && s.end >= lo);
    if (at) {
      return { chips: [at.chip], start: at.start, end: at.end };
    }
    return { chips: [], start: lo, end: hi };
  }

  return {
    chips: overlap.map((s) => s.chip),
    start: overlap[0].start,
    end: overlap[overlap.length - 1].end,
  };
}

function parseFilters(raw: string): LabelFilter[] {
  const filters: LabelFilter[] = [];
  const brace = raw.match(/\{([^}]*)\}/);
  if (!brace) {
    return filters;
  }
  const re = /([A-Za-z_][A-Za-z0-9_]*)\s*(=~|!~|!=|=)\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(brace[1])) !== null) {
    filters.push({ label: m[1], op: m[2], value: m[3] });
  }
  return filters;
}

export function understand(raw: string): Understanding {
  const topkMatch = raw.match(/topk\s*\(\s*(\d+)/);
  const rngMatch = raw.match(/\[(\d+)([smhdw])\]/);
  const byMatch = raw.match(/by\s*\(([^)]*)\)/);
  const pctMatch = raw.match(/histogram_quantile\s*\(\s*([0-9.]+)/);

  const isP95 = /histogram_quantile/.test(raw);
  const isAverage = /_sum\b/.test(raw) && /_count\b/.test(raw) && raw.includes('/');

  const features: QueryFeatures = {
    metricBase: 'server_requests_duration_seconds',
    mode: isP95 ? 'p95' : isAverage ? 'average' : 'raw',
    percentile: pctMatch ? Math.round(parseFloat(pctMatch[1]) * 100) : 95,
    topk: topkMatch ? Number(topkMatch[1]) : null,
    range: rngMatch ? { num: Number(rngMatch[1]), unit: rngMatch[2] } : null,
    groupBy: byMatch
      ? byMatch[1]
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s && s !== 'le')
      : [],
    filters: parseFilters(raw),
  };

  return {
    features,
    sentence: describe(features),
    flow: buildFlow(features),
    why: buildWhy(features),
  };
}

const UNIT_WORDS: Record<string, string> = { s: 'second', m: 'minute', h: 'hour', d: 'day', w: 'week' };

function formatRange(range: QueryFeatures['range']): string {
  if (!range) {
    return 'the selected range';
  }
  const word = UNIT_WORDS[range.unit] ?? 'minute';
  return `${range.num} ${word}${range.num === 1 ? '' : 's'}`;
}

function describe(f: QueryFeatures): string {
  const n = f.topk ?? 5;
  let metricDesc: string;
  if (f.mode === 'p95') {
    metricDesc = `the ${f.percentile}th percentile request duration`;
  } else if (f.mode === 'average') {
    metricDesc = 'average request duration';
  } else {
    metricDesc = 'request duration';
  }

  const svc = f.filters.find((x) => x.label === 'service_name');
  const status = f.filters.find((x) => x.label === 'status_code');
  const parts: string[] = [];
  if (svc) {
    parts.push(`for ${svc.value}`);
  }
  if (status) {
    parts.push('for failed (5xx) requests');
  }
  const filterPhrase = parts.length ? ` ${parts.join(', ')}` : '';

  return `Top ${n} slowest paths${filterPhrase}, based on ${metricDesc} over the last ${formatRange(f.range)}.`;
}

function buildWhy(f: QueryFeatures): string {
  if (f.mode === 'p95') {
    return `Buckets request durations, estimates the ${f.percentile}th percentile per path, and shows the ${
      f.topk ?? 5
    } slowest. Percentiles surface the slow tail that an average hides.`;
  }
  if (f.mode === 'average') {
    return `Adds up the total time spent and number of requests for each path, then divides the two to get the average latency, and displays the ${
      f.topk ?? 5
    } slowest.`;
  }
  return 'Shows request duration per path.';
}

function buildFlow(f: QueryFeatures): QueryFlow {
  const base = f.metricBase;
  const by = f.groupBy.length ? f.groupBy.join(', ') : 'path, service_name';
  const filterSuffix = f.filters.length ? `{${f.filters.map((x) => `${x.label}${x.op}"${x.value}"`).join(', ')}}` : '';

  if (f.mode === 'p95') {
    return {
      branches: [
        [
          { role: 'metric', text: `${base}_bucket${filterSuffix}`, caption: 'latency buckets' },
          { role: 'function', text: 'rate(' },
          { role: 'aggregation', text: `sum by(le, ${by})` },
          { role: 'transform', text: `histogram_quantile(0.${f.percentile})` },
        ],
      ],
      merge: [{ role: 'transform', text: `topk(${f.topk ?? 5})`, caption: `${f.topk ?? 5} slowest` }],
    };
  }

  const branch = (suffix: string, caption: string): FlowNode[] => [
    { role: 'metric', text: `${base}_${suffix}${filterSuffix}`, caption },
    { role: 'function', text: 'rate(' },
    { role: 'aggregation', text: `sum by(${by})` },
  ];

  return {
    branches: [branch('sum', 'total duration'), branch('count', 'request count')],
    merge: [
      { role: 'operator', text: '/', caption: 'average' },
      { role: 'transform', text: `topk(${f.topk ?? 5})`, caption: `${f.topk ?? 5} slowest` },
    ],
  };
}

// ---------------------------------------------------------------------------
// Explanations
// ---------------------------------------------------------------------------

export function explainChip(chip: Chip): string {
  switch (chip.role) {
    case 'transform':
      if (/^topk/i.test(chip.text)) {
        return 'Keeps only the series with the largest values (top N).';
      }
      if (/histogram_quantile/i.test(chip.text)) {
        return 'Estimates a percentile from histogram buckets.';
      }
      return 'Transforms the result set.';
    case 'aggregation': {
      const by = chip.text.match(/by\s*\(([^)]*)\)/);
      return by ? `Sums matching series, grouped by ${by[1]}.` : 'Aggregates matching series into one.';
    }
    case 'function':
      return 'Per-second average rate of increase, computed over the range window.';
    case 'metric':
      if (/_sum/.test(chip.text)) {
        return 'Cumulative total request duration (histogram _sum).';
      }
      if (/_count/.test(chip.text)) {
        return 'Cumulative request count (histogram _count).';
      }
      if (/_bucket/.test(chip.text)) {
        return 'Histogram buckets of request duration.';
      }
      if (/\{/.test(chip.text)) {
        return 'Metric selector, filtered by the labels in braces.';
      }
      return 'Metric selector.';
    case 'range':
      return `Look-back window of ${chip.text.replace(/[[\]]/g, '')}.`;
    case 'operator':
      return 'Binary operation applied between the left and right expressions.';
    default:
      return '';
  }
}

/** Explanation for a (snapped) multi-chip selection. */
export function explainSelection(selected: Chip[]): string {
  const chips = selected.filter((c) => c.selectable);
  if (chips.length === 0) {
    return '';
  }
  if (chips.length === 1) {
    return explainChip(chips[0]);
  }

  const roles = chips.map((c) => c.role);
  const range = chips.find((c) => c.role === 'range');
  if (roles.includes('function') && range) {
    return `Per-second rate of change of this metric, averaged over each ${range.text.replace(/[[\]]/g, '')} window.`;
  }
  if (roles.includes('operator') && chips.some((c) => /_sum/.test(c.text))) {
    return 'Average request duration = total duration ÷ request count.';
  }
  if (roles.every((r) => r === 'aggregation')) {
    return 'Groups and sums the matching series by the listed labels.';
  }
  return 'This whole section is treated as one step in the query.';
}

/** Contextual modify suggestions that adapt to what the user highlighted. */
export function suggestionsFor(selected: Chip[] | null): Array<{ label: string; title: string; detail: string }> {
  const role = selected && selected.length === 1 ? selected[0].role : null;

  if (role === 'metric' || (selected && selected.some((c) => c.role === 'metric'))) {
    return [
      {
        label: 'Narrow results',
        title: 'Scope to a specific service',
        detail: 'Filter to the slowest paths of one service instead of every service.',
      },
      {
        label: 'Focus failures',
        title: 'Only failed requests',
        detail: 'Add a status_code=~"5.." matcher to look at errors only.',
      },
    ];
  }

  if (role === 'aggregation') {
    return [
      {
        label: 'Change grouping',
        title: 'Group by a different label',
        detail: 'Break the result down by status_code instead of path.',
      },
      {
        label: 'Narrow results',
        title: 'Scope to a specific service',
        detail: 'Filter this branch to a single service.',
      },
    ];
  }

  // Default (no selection / whole query) — matches the Figma mock.
  return [
    {
      label: 'Cheaper alternative query',
      title: 'p95 instead of average',
      detail: 'Averaging hides outliers. See the latency of the slowest requests.',
    },
    {
      label: 'Narrow results',
      title: 'Scope to specific service',
      detail: 'Filter to slowest paths of a specific service you care about, rather than any service anywhere.',
    },
  ];
}

// ---------------------------------------------------------------------------
// Scripted modifications
// ---------------------------------------------------------------------------

function addLabelMatcher(raw: string, matcher: string): string {
  return raw.replace(
    /(server_requests_duration_seconds_(?:sum|count|bucket|total))(\{([^}]*)\})?/g,
    (_full, metric: string, _braces: string | undefined, inner: string | undefined) =>
      inner ? `${metric}{${inner}, ${matcher}}` : `${metric}{${matcher}}`
  );
}

function toP95(raw: string): string {
  const n = raw.match(/topk\s*\(\s*(\d+)/)?.[1] ?? '5';
  const range = raw.match(/\[[^\]]+\]/)?.[0] ?? '[5m]';
  const by = raw.match(/by\s*\(([^)]*)\)/)?.[1]?.replace(/\ble\b,?\s*/, '') ?? 'path, service_name';
  const filters = parseFilters(raw);
  const filterSuffix = filters.length ? `{${filters.map((x) => `${x.label}${x.op}"${x.value}"`).join(', ')}}` : '';
  return `topk(${n}, histogram_quantile(0.95, sum by(le, ${by}) (rate(server_requests_duration_seconds_bucket${filterSuffix}${range}))))`;
}

/**
 * Maps a natural-language modify request to a pre-scripted new query.
 * Keyword-matched against the small fixed set of demo scenarios.
 */
export function interpretModify(text: string, workingRaw: string): ModifyResult {
  const t = text.toLowerCase().trim();

  // Build-up requests only apply while the query is still just a bare metric.
  const isBare = !workingRaw.includes('(') && /[a-z_]/i.test(workingRaw);
  if (isBare) {
    const metric = workingRaw.trim();
    if (/top|slowest|latency|average|avg|duration/.test(t)) {
      return {
        newRaw: BASE_QUERY,
        confidence: 76,
        kind: 'build',
        label: 'top 5 slowest paths',
        note: 'Built the average-latency query (total duration ÷ request count) and kept the 5 slowest paths.',
      };
    }
    if (/rate|per.?second|counter/.test(t)) {
      return {
        newRaw: `rate(${metric}[5m])`,
        confidence: 90,
        kind: 'build',
        label: 'per-second rate',
        note: 'Wrapped the counter in rate() over a 5-minute window.',
      };
    }
    if (/sum|aggregate|group|by /.test(t)) {
      return {
        newRaw: `sum by(path, service_name) (rate(${metric}[5m]))`,
        confidence: 84,
        kind: 'build',
        label: 'sum by path',
        note: 'Took the per-second rate and summed it grouped by path and service.',
      };
    }
  }

  if (/p9\d|percentile|quantile|outlier|tail|slowest requests/.test(t)) {
    return {
      newRaw: toP95(workingRaw),
      confidence: 78,
      kind: 'p95',
      label: 'p95 instead of average',
      note: 'Switched from an average to a 95th-percentile estimate over histogram buckets. Averages hide outliers; p95 surfaces the slow tail.',
    };
  }

  if (/error|5xx|4xx|fail|status/.test(t)) {
    return {
      newRaw: addLabelMatcher(workingRaw, 'status_code=~"5.."'),
      confidence: 88,
      kind: 'errors',
      label: 'only errors',
      note: 'Added a status_code=~"5.." matcher to both selectors, so only failed (5xx) requests are counted.',
    };
  }

  if (/checkout|auth|search|service|scope|narrow|filter|only/.test(t)) {
    const svc = /auth/.test(t) ? 'auth-service' : /search/.test(t) ? 'search-service' : 'checkout-service';
    return {
      newRaw: addLabelMatcher(workingRaw, `service_name="${svc}"`),
      confidence: 92,
      kind: 'filter',
      label: `filter to ${svc}`,
      note: `Added a service_name="${svc}" matcher to both selectors, scoping the panel to that service.`,
    };
  }

  return {
    newRaw: workingRaw,
    confidence: 35,
    kind: 'unknown',
    label: 'no change',
    note: `Couldn't map "${text}" to a change in this prototype. Try: "only checkout-service", "use p95 instead of average", or "only errors".`,
  };
}

export interface CommandSuggestion {
  label: string;
  title: string;
  detail: string;
  result: ModifyResult;
}

/**
 * Contextual "next step" suggestions for the /-command popover. They adapt to
 * how far along the query is: a bare metric gets build-up steps, a complete
 * query gets refinements. Each carries a precomputed result so it can be
 * applied directly.
 */
export function commandSuggestions(raw: string): CommandSuggestion[] {
  const isBare = !raw.includes('(') && /[a-z_]/i.test(raw);

  if (isBare) {
    const metric = raw.trim() || 'server_requests_duration_seconds_count';
    return [
      {
        label: 'Rate',
        title: 'Per-second rate over 5m',
        detail: 'This looks like a counter — wrap it in rate() to see per-second change instead of a cumulative total.',
        result: {
          newRaw: `rate(${metric}[5m])`,
          confidence: 90,
          kind: 'build',
          label: 'per-second rate',
          note: 'Wrapped the counter in rate() over a 5-minute window.',
        },
      },
      {
        label: 'Aggregate',
        title: 'Sum by path & service',
        detail: 'Group the per-second rate by request path and service, summed across instances.',
        result: {
          newRaw: `sum by(path, service_name) (rate(${metric}[5m]))`,
          confidence: 84,
          kind: 'build',
          label: 'sum by path',
          note: 'Took the per-second rate and summed it grouped by path and service.',
        },
      },
      {
        label: 'Full query',
        title: 'Top 5 slowest paths (avg latency)',
        detail: 'Build the average request duration per path and keep the 5 slowest.',
        result: {
          newRaw: BASE_QUERY,
          confidence: 76,
          kind: 'build',
          label: 'top 5 slowest paths',
          note: 'Built the average-latency query (total duration ÷ request count) and kept the 5 slowest paths.',
        },
      },
    ];
  }

  return [
    {
      label: 'Cheaper alternative query',
      title: 'p95 instead of average',
      detail: 'Averaging hides outliers. See the latency of the slowest requests.',
      result: interpretModify('use p95 instead of average', raw),
    },
    {
      label: 'Narrow results',
      title: 'Scope to checkout-service',
      detail: 'Filter to the slowest paths of one service you care about.',
      result: interpretModify('only checkout-service', raw),
    },
    {
      label: 'Focus failures',
      title: 'Only failed (5xx) requests',
      detail: 'Add a status_code=~"5.." matcher to look at errors only.',
      result: interpretModify('only errors', raw),
    },
  ];
}

/**
 * Detects what a manual text edit did, relative to a baseline query, and
 * returns a short human suggestion (State 5 in the plan).
 */
export function detectManualEdit(baseRaw: string, nextRaw: string): { summary: string; suggestion: string } | null {
  if (baseRaw.trim() === nextRaw.trim()) {
    return null;
  }
  const before = understand(baseRaw).features;
  const after = understand(nextRaw).features;

  const newSvc = after.filters.find((f) => f.label === 'service_name');
  const oldSvc = before.filters.find((f) => f.label === 'service_name');
  if (newSvc && newSvc.value !== oldSvc?.value) {
    return {
      summary: `Filtered to service_name="${newSvc.value}".`,
      suggestion: `Want to rename the panel title to “Slowest paths — ${newSvc.value}” to match?`,
    };
  }

  const newStatus = after.filters.find((f) => f.label === 'status_code');
  if (newStatus && !before.filters.some((f) => f.label === 'status_code')) {
    return {
      summary: 'Filtered to a subset of status codes.',
      suggestion: 'This now excludes successful requests — confirm that’s intended for a latency panel.',
    };
  }

  if (after.mode === 'p95' && before.mode !== 'p95') {
    return {
      summary: 'Switched to a percentile (histogram_quantile).',
      suggestion: 'Make sure the metric exposes _bucket series, or this will return no data.',
    };
  }

  if (after.range && before.range && (after.range.num !== before.range.num || after.range.unit !== before.range.unit)) {
    return {
      summary: `Changed the look-back window to ${formatRange(after.range)}.`,
      suggestion: 'Longer windows smooth spikes; shorter windows react faster but look noisier.',
    };
  }

  return { summary: 'Query changed.', suggestion: 'Re-derived the translation from your edit.' };
}

// ---------------------------------------------------------------------------
// Semantic (chip-level) diff
// ---------------------------------------------------------------------------

export type DiffType = 'same' | 'added' | 'changed';

export interface ChipDiff {
  status: Map<string, { type: DiffType; from?: string }>;
  removed: Chip[];
}

const norm = (c: Chip) => c.text.replace(/\s+/g, ' ').trim();

function baseId(c: Chip): string {
  if (c.role === 'metric') {
    return c.text.replace(/\{[^}]*\}/, '').trim();
  }
  if (c.role === 'aggregation' || c.role === 'transform' || c.role === 'function') {
    return c.role + ':' + (c.text.match(/^[A-Za-z_]+/)?.[0] ?? c.text);
  }
  return c.role;
}

/** Chip-level diff: which stages were added / changed / removed. */
export function diffChips(oldChips: Chip[], newChips: Chip[]): ChipDiff {
  const a = oldChips.filter((c) => c.selectable);
  const b = newChips.filter((c) => c.selectable);
  const n = a.length;
  const m = b.length;

  // Longest common subsequence over normalized chip text.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = norm(a[i]) === norm(b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const status = new Map<string, { type: DiffType; from?: string }>();
  const removed: Chip[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (norm(a[i]) === norm(b[j])) {
      status.set(b[j].id, { type: 'same' });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      removed.push(a[i]);
      i++;
    } else {
      status.set(b[j].id, { type: 'added' });
      j++;
    }
  }
  while (j < m) {
    status.set(b[j].id, { type: 'added' });
    j++;
  }
  while (i < n) {
    removed.push(a[i]);
    i++;
  }

  // Pair an added chip with a removed chip of the same "identity" -> "changed".
  const removedRemaining = [...removed];
  for (const chip of b) {
    const st = status.get(chip.id);
    if (st?.type !== 'added') {
      continue;
    }
    const idx = removedRemaining.findIndex((rc) => rc.role === chip.role && baseId(rc) === baseId(chip));
    if (idx >= 0) {
      status.set(chip.id, { type: 'changed', from: removedRemaining[idx].text });
      removedRemaining.splice(idx, 1);
    }
  }

  return { status, removed: removedRemaining };
}
