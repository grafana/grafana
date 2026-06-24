// Deterministic PromQL/LogQL -> plain English compiler.
//
// This intentionally avoids a full AST/grammar dependency: alert queries follow a
// small set of common shapes (rate/increase, histogram_quantile, aggregations with
// `by (...)`, range windows, inline thresholds) and a pattern matcher covers them
// reliably and offline. The structured `QueryFacts` it produces is reused by the
// adversarial review step, so parsing happens once and both features share it.

export type QueryLanguage = 'promql' | 'logql' | 'unknown';

export interface LabelMatcher {
  label: string;
  op: string; // = != =~ !~
  value: string;
}

export interface QueryFacts {
  language: QueryLanguage;
  raw: string;
  /** Primary metric or, for LogQL, the stream selector matchers. */
  metric?: string;
  /** sum | avg | min | max | count | stddev | stdvar | topk | bottomk | quantile */
  aggregation?: string;
  /** Labels in a `by (...)` / `without (...)` clause. */
  groupBy?: string[];
  /** rate | irate | increase | delta | histogram_quantile | <agg>_over_time */
  func?: string;
  /** Quantile argument of histogram_quantile, e.g. 0.95. */
  quantile?: number;
  /** Range-vector window, e.g. "5m". */
  range?: string;
  /** Comparison operator of an inline threshold, e.g. ">". */
  comparator?: string;
  /** Right-hand side of an inline threshold, e.g. "0.5". */
  threshold?: string;
  /** Label matchers on the metric / stream selector. */
  matchers?: LabelMatcher[];
  /** LogQL line filters, already rendered to English fragments. */
  logFilters?: string[];
}

export interface QueryDescription {
  text: string;
  facts: QueryFacts;
  /** False when the parser fell back to echoing the raw expression. */
  confident: boolean;
}

/** A threshold sourced from a separate expression query rather than inline in the expr. */
export interface ThresholdInfo {
  comparator: string;
  value: string;
}

const RANGE_VECTOR_FUNCS = ['rate', 'irate', 'increase', 'delta', 'idelta', 'deriv'];
const OVER_TIME_FUNCS = [
  'avg_over_time',
  'min_over_time',
  'max_over_time',
  'sum_over_time',
  'count_over_time',
  'last_over_time',
  'stddev_over_time',
  'quantile_over_time',
];
const AGGREGATIONS = ['sum', 'avg', 'min', 'max', 'count', 'stddev', 'stdvar', 'topk', 'bottomk', 'group', 'count_values'];

const COMPARATOR_PHRASES: Record<string, string> = {
  '>': 'rises above',
  '>=': 'reaches or exceeds',
  '<': 'drops below',
  '<=': 'falls to or below',
  '==': 'equals',
  '!=': 'is not equal to',
};

const AGGREGATION_WORDS: Record<string, string> = {
  sum: 'total',
  avg: 'average',
  min: 'minimum',
  max: 'maximum',
  count: 'number of series of',
  stddev: 'standard deviation of',
  stdvar: 'variance of',
};

function detectLanguage(expr: string): QueryLanguage {
  // LogQL is identifiable by line/label filter pipes following a stream selector.
  const hasLineFilter = /\|[=~]|!~|!=\s*`|!=\s*"/.test(expr);
  const hasLogPipe = /\|\s*(json|logfmt|pattern|regexp|line_format|label_format|unwrap|decolorize|drop|keep)\b/.test(
    expr
  );
  const hasOverTimeOnStream = /_over_time\s*\(\s*\{/.test(expr);
  if (hasLineFilter || hasLogPipe || hasOverTimeOnStream) {
    return 'logql';
  }
  if (/[a-zA-Z_:][a-zA-Z0-9_:]*\s*(\{|\[|\()/.test(expr) || /\d/.test(expr)) {
    return 'promql';
  }
  return 'unknown';
}

function parseMatchers(inner: string): LabelMatcher[] {
  const matchers: LabelMatcher[] = [];
  // label op "value" — value may use single or double quotes / backticks.
  const re = /([a-zA-Z_][a-zA-Z0-9_]*)\s*(=~|!~|!=|=)\s*(["'`])((?:\\.|[^\\])*?)\3/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    matchers.push({ label: m[1], op: m[2], value: m[4] });
  }
  return matchers;
}

function parseLogFilters(expr: string): string[] {
  const filters: string[] = [];
  const re = /(\|=|\|~|!=|!~)\s*(["'`])((?:\\.|[^\\])*?)\2/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr)) !== null) {
    const [, op, , value] = m;
    if (op === '|=') {
      filters.push(`containing "${value}"`);
    } else if (op === '|~') {
      filters.push(`matching /${value}/`);
    } else if (op === '!=') {
      filters.push(`not containing "${value}"`);
    } else if (op === '!~') {
      filters.push(`not matching /${value}/`);
    }
  }
  return filters;
}

function parseGroupBy(expr: string): string[] | undefined {
  // Matches both `sum by (a, b) (...)` and `sum(...) by (a, b)`.
  const m = expr.match(/\b(?:by|without)\s*\(([^)]*)\)/);
  if (!m) {
    return undefined;
  }
  const labels = m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return labels.length ? labels : undefined;
}

function parseInlineThreshold(expr: string): { comparator: string; threshold: string } | undefined {
  // Top-level comparison, typically trailing: `... > 0.5` or `... >= bool 10`.
  const m = expr.match(/(>=|<=|==|!=|>|<)\s*(?:bool\s+)?(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) {
    return undefined;
  }
  return { comparator: m[1], threshold: m[2] };
}

function findMetricName(expr: string): string | undefined {
  // First identifier followed by `{` or `[`, skipping known function names.
  const re = /([a-zA-Z_:][a-zA-Z0-9_:]*)\s*(\{|\[)/g;
  const reserved = new Set([...RANGE_VECTOR_FUNCS, ...OVER_TIME_FUNCS, ...AGGREGATIONS, 'histogram_quantile']);
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr)) !== null) {
    if (!reserved.has(m[1])) {
      return m[1];
    }
  }
  // Fall back to a bare metric name (no selector), e.g. `up`.
  const bare = expr.match(/\b([a-zA-Z_:][a-zA-Z0-9_:]*)\b/);
  return bare && !reserved.has(bare[1]) ? bare[1] : undefined;
}

function parsePromQL(expr: string): QueryFacts {
  const facts: QueryFacts = { language: 'promql', raw: expr };

  const hq = expr.match(/histogram_quantile\s*\(\s*(-?\d+(?:\.\d+)?)\s*,/);
  if (hq) {
    facts.func = 'histogram_quantile';
    facts.quantile = Number(hq[1]);
  } else {
    const overTime = OVER_TIME_FUNCS.find((fn) => new RegExp(`\\b${fn}\\s*\\(`).test(expr));
    const rangeFn = RANGE_VECTOR_FUNCS.find((fn) => new RegExp(`\\b${fn}\\s*\\(`).test(expr));
    facts.func = overTime ?? rangeFn;
  }

  const agg = AGGREGATIONS.find((fn) => new RegExp(`\\b${fn}\\b\\s*(by|without)?\\s*\\(`).test(expr));
  if (agg) {
    facts.aggregation = agg;
  }

  facts.groupBy = parseGroupBy(expr);

  const range = expr.match(/\[\s*(\d+[smhdwy]+)\s*\]/);
  if (range) {
    facts.range = range[1];
  }

  const matcherBlock = expr.match(/\{([^}]*)\}/);
  if (matcherBlock) {
    const matchers = parseMatchers(matcherBlock[1]);
    if (matchers.length) {
      facts.matchers = matchers;
    }
  }

  facts.metric = findMetricName(expr);

  const inline = parseInlineThreshold(expr);
  if (inline) {
    facts.comparator = inline.comparator;
    facts.threshold = inline.threshold;
  }

  return facts;
}

function parseLogQL(expr: string): QueryFacts {
  const facts: QueryFacts = { language: 'logql', raw: expr };

  const overTime = OVER_TIME_FUNCS.find((fn) => new RegExp(`\\b${fn}\\s*\\(`).test(expr));
  const rateFn = /\brate\s*\(/.test(expr) ? 'rate' : undefined;
  facts.func = overTime ?? rateFn;

  const agg = AGGREGATIONS.find((fn) => new RegExp(`\\b${fn}\\b\\s*(by|without)?\\s*\\(`).test(expr));
  if (agg) {
    facts.aggregation = agg;
  }

  facts.groupBy = parseGroupBy(expr);

  const range = expr.match(/\[\s*(\d+[smhdwy]+)\s*\]/);
  if (range) {
    facts.range = range[1];
  }

  const selector = expr.match(/\{([^}]*)\}/);
  if (selector) {
    const matchers = parseMatchers(selector[1]);
    if (matchers.length) {
      facts.matchers = matchers;
    }
  }

  const logFilters = parseLogFilters(expr);
  if (logFilters.length) {
    facts.logFilters = logFilters;
  }

  const inline = parseInlineThreshold(expr);
  if (inline) {
    facts.comparator = inline.comparator;
    facts.threshold = inline.threshold;
  }

  return facts;
}

export function parseQueryFacts(expr: string): QueryFacts {
  const trimmed = expr.trim();
  const language = detectLanguage(trimmed);
  if (language === 'logql') {
    return parseLogQL(trimmed);
  }
  if (language === 'promql') {
    return parsePromQL(trimmed);
  }
  return { language: 'unknown', raw: trimmed };
}

function percentile(quantile: number): string {
  const pct = quantile <= 1 ? quantile * 100 : quantile;
  if (pct === 50) {
    return 'median';
  }
  const rounded = Number.isInteger(pct) ? pct : Number(pct.toFixed(1));
  const tens = Math.floor(rounded) % 100;
  const ones = Math.floor(rounded) % 10;
  let suffix = 'th';
  if (tens < 11 || tens > 13) {
    if (ones === 1) {
      suffix = 'st';
    } else if (ones === 2) {
      suffix = 'nd';
    } else if (ones === 3) {
      suffix = 'rd';
    }
  }
  return `${rounded}${suffix} percentile`;
}

function matchersToPhrase(matchers: LabelMatcher[]): string {
  return matchers
    .map((m) => {
      if (m.op === '=') {
        return `${m.label}=${m.value}`;
      }
      if (m.op === '!=') {
        return `${m.label}≠${m.value}`;
      }
      if (m.op === '=~') {
        return `${m.label} matching /${m.value}/`;
      }
      return `${m.label} not matching /${m.value}/`;
    })
    .join(', ');
}

/** Builds the measurement core phrase (no leading article). */
function measurementCore(facts: QueryFacts): string {
  const metric = facts.metric ? `\`${facts.metric}\`` : 'the series';

  let core: string;
  switch (facts.func) {
    case 'rate':
    case 'irate':
      core = `per-second rate of ${metric}`;
      break;
    case 'increase':
      core = `increase in ${metric}`;
      break;
    case 'delta':
    case 'idelta':
      core = `change in ${metric}`;
      break;
    case 'deriv':
      core = `per-second derivative of ${metric}`;
      break;
    case 'avg_over_time':
      core = `average of ${metric}`;
      break;
    case 'max_over_time':
      core = `maximum of ${metric}`;
      break;
    case 'min_over_time':
      core = `minimum of ${metric}`;
      break;
    case 'sum_over_time':
      core = `sum of ${metric}`;
      break;
    case 'last_over_time':
      core = `most recent value of ${metric}`;
      break;
    case 'count_over_time':
      core = facts.language === 'logql' ? `count of log lines` : `count of samples of ${metric}`;
      break;
    case 'histogram_quantile':
      core = facts.quantile != null ? `${percentile(facts.quantile)} of ${metric}` : `quantile of ${metric}`;
      break;
    default:
      core = facts.language === 'logql' ? `rate of log lines` : metric;
  }

  // For histogram_quantile the metric is a `_bucket` series; describe the observed thing.
  if (facts.func === 'histogram_quantile' && facts.metric?.endsWith('_bucket')) {
    const base = facts.metric.replace(/_bucket$/, '');
    core = facts.quantile != null ? `${percentile(facts.quantile)} of \`${base}\`` : `quantile of \`${base}\``;
  }

  // Aggregation wrapper (skip for histogram_quantile — the `by (le)` there is mechanical).
  if (facts.aggregation && facts.func !== 'histogram_quantile') {
    const word = AGGREGATION_WORDS[facts.aggregation] ?? `${facts.aggregation} of`;
    core = `${word} ${core}`;
  }

  if (facts.language === 'logql') {
    if (facts.matchers?.length) {
      core += ` from ${matchersToPhrase(facts.matchers)}`;
    }
    if (facts.logFilters?.length) {
      core += ` ${facts.logFilters.join(' and ')}`;
    }
    if (facts.range) {
      core += ` over the last ${facts.range}`;
    }
  } else {
    if (facts.range && facts.func !== 'histogram_quantile') {
      core += ` over the last ${facts.range}`;
    }
    if (facts.matchers?.length && facts.func !== 'histogram_quantile') {
      core += ` (filtered to ${matchersToPhrase(facts.matchers)})`;
    }
  }

  // Grouping. histogram_quantile always carries the mechanical `le` label — drop it
  // and only surface the labels the percentile is actually broken down by.
  let groupBy = facts.groupBy;
  if (facts.func === 'histogram_quantile' && groupBy) {
    groupBy = groupBy.filter((label) => label !== 'le');
  }
  if (groupBy?.length) {
    core += `, grouped by ${groupBy.join(', ')}`;
  }

  return core;
}

function factsToEnglish(facts: QueryFacts, threshold?: ThresholdInfo): string {
  const core = measurementCore(facts);

  const comparator = facts.comparator ?? threshold?.comparator;
  const value = facts.threshold ?? threshold?.value;

  if (comparator && value != null) {
    const phrase = COMPARATOR_PHRASES[comparator] ?? `crosses ${comparator}`;
    return `Fires when the ${core} ${phrase} ${value}.`;
  }

  return `Fires based on the ${core}.`;
}

/**
 * Compile an alert query expression into a plain-English description.
 *
 * @param expr the PromQL/LogQL expression (typically the condition query's `model.expr`)
 * @param options.threshold a threshold sourced from a separate expression query, used
 *   when the expression itself has no inline comparison
 */
export function compileQueryDescription(expr: string, options?: { threshold?: ThresholdInfo }): QueryDescription {
  const trimmed = (expr ?? '').trim();
  if (!trimmed) {
    return {
      text: '',
      facts: { language: 'unknown', raw: '' },
      confident: false,
    };
  }

  const facts = parseQueryFacts(trimmed);

  // Confident when we recognised structure we can describe meaningfully.
  const confident =
    facts.language !== 'unknown' && Boolean(facts.metric || facts.func || facts.aggregation || facts.matchers?.length);

  if (!confident) {
    return {
      text: `Fires based on the query \`${trimmed}\`.`,
      facts,
      confident: false,
    };
  }

  return {
    text: factsToEnglish(facts, options?.threshold),
    facts,
    confident: true,
  };
}
