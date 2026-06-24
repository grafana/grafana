export interface QueryFacts {
  language: 'promql' | 'logql' | 'unknown';
  metric?: string;
  aggregation?: string;
  groupBy?: string[];
  groupByMode?: 'by' | 'without';
  func?: string;
  quantile?: number;
  rangeWindow?: string;
  comparator?: string;
  threshold?: number;
  labelMatchers?: Array<{ label: string; op: string; value: string }>;
  logLineFilters?: Array<{ op: string; value: string }>;
}

interface CompileOpts {
  threshold?: { comparator: string; value: number };
}

interface CompileResult {
  text: string;
  facts: QueryFacts;
  confident: boolean;
}

const COMPARATOR_WORDS: Record<string, string> = {
  '>': 'rises above',
  '>=': 'reaches or exceeds',
  '<': 'drops below',
  '<=': 'falls to or below',
  '==': 'equals',
  '!=': 'is not equal to',
};

const QUANTILE_NAMES: Record<number, string> = {
  0.5: 'median',
  0.9: '90th percentile',
  0.95: '95th percentile',
  0.99: '99th percentile',
  0.999: '99.9th percentile',
};

const AGGREGATIONS = ['sum', 'avg', 'min', 'max', 'count', 'stddev', 'stdvar', 'topk', 'bottomk', 'group'];
const RANGE_FUNCS = [
  'rate',
  'irate',
  'increase',
  'delta',
  'deriv',
  'idelta',
  'avg_over_time',
  'sum_over_time',
  'min_over_time',
  'max_over_time',
  'count_over_time',
  'stddev_over_time',
  'stdvar_over_time',
  'last_over_time',
  'present_over_time',
  'quantile_over_time',
  'absent_over_time',
];

function extractGroupBy(expr: string): { mode?: 'by' | 'without'; labels: string[]; rest: string } {
  const m = expr.match(/\b(by|without)\s*\(([^)]*)\)/i);
  if (!m) {
    return { labels: [], rest: expr };
  }
  const lowered = m[1].toLowerCase();
  const mode: 'by' | 'without' = lowered === 'without' ? 'without' : 'by';
  const labels = m[2]
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean);
  const rest = expr.replace(m[0], '').trim();
  return { mode, labels, rest };
}

function extractLabelMatchers(expr: string): Array<{ label: string; op: string; value: string }> {
  const matchers: Array<{ label: string; op: string; value: string }> = [];
  const re = /\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(expr)) !== null) {
    const inner = m[1];
    const pairRe = /(\w+)\s*(=~|!~|!=|=)\s*"([^"]*)"/g;
    let pair;
    while ((pair = pairRe.exec(inner)) !== null) {
      matchers.push({ label: pair[1], op: pair[2], value: pair[3] });
    }
  }
  return matchers;
}

function extractLogLineFilters(expr: string): Array<{ op: string; value: string }> {
  const filters: Array<{ op: string; value: string }> = [];
  const re = /(\|=|!\~|!=|\|~)\s*`([^`]*)`|\b(\|=|!\~|!=|\|~)\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(expr)) !== null) {
    const op = m[1] || m[3];
    const value = m[2] || m[4];
    filters.push({ op, value });
  }
  return filters;
}

function extractInlineComparison(expr: string): { comparator?: string; threshold?: number; baseExpr: string } {
  const m = expr.match(/\s*(>=|<=|!=|==|>|<)\s*(-?[\d.]+)\s*$/);
  if (!m) {
    return { baseExpr: expr };
  }
  return {
    comparator: m[1],
    threshold: parseFloat(m[2]),
    baseExpr: expr.slice(0, m.index).trim(),
  };
}

export function parseQueryFacts(expr: string): QueryFacts {
  if (!expr || !expr.trim()) {
    return { language: 'unknown' };
  }

  const trimmed = expr.trim();
  const logLineFilters = extractLogLineFilters(trimmed);
  const labelMatchers = extractLabelMatchers(trimmed);

  let language: 'promql' | 'logql' | 'unknown' = 'unknown';
  if (logLineFilters.length > 0 || /^\s*\{[^}]*\}\s*(\||$)/.test(trimmed)) {
    language = 'logql';
  } else if (labelMatchers.length > 0 || /\b(rate|sum|avg|histogram_quantile|increase)\s*\(/.test(trimmed)) {
    language = 'promql';
  }

  const { comparator, threshold, baseExpr } = extractInlineComparison(trimmed);
  const working = baseExpr;

  const facts: QueryFacts = { language };
  if (comparator) {
    facts.comparator = comparator;
  }
  if (threshold !== undefined) {
    facts.threshold = threshold;
  }
  if (labelMatchers.length > 0) {
    facts.labelMatchers = labelMatchers;
  }
  if (logLineFilters.length > 0) {
    facts.logLineFilters = logLineFilters;
  }

  const histMatch = working.match(/histogram_quantile\s*\(\s*([\d.]+)\s*,/);
  if (histMatch) {
    facts.func = 'histogram_quantile';
    facts.quantile = parseFloat(histMatch[1]);
  }

  const aggPattern = new RegExp(`\\b(${AGGREGATIONS.join('|')})\\s*(\\(|\\s+by\\s*\\(|\\s+without\\s*\\()`, 'i');
  const aggMatch = working.match(aggPattern);
  if (aggMatch) {
    facts.aggregation = aggMatch[1].toLowerCase();
  }

  const { mode, labels } = extractGroupBy(working);
  if (labels.length > 0) {
    facts.groupBy = labels;
    facts.groupByMode = mode;
  }

  const funcPattern = new RegExp(`\\b(${RANGE_FUNCS.join('|')})\\s*\\(`, 'i');
  const funcMatch = working.match(funcPattern);
  if (funcMatch) {
    facts.func = facts.func || funcMatch[1].toLowerCase();
  }

  const rangeMatch = working.match(/\[(\d+[smhdwy])\]/);
  if (rangeMatch) {
    facts.rangeWindow = rangeMatch[1];
  }

  const metricRe = /\b([a-zA-Z_:][a-zA-Z0-9_:]*)\s*[\{[({]/;
  const allMetricMatches = [...working.matchAll(new RegExp(metricRe, 'g'))];
  for (const mm of allMetricMatches) {
    const name = mm[1];
    if (
      !AGGREGATIONS.includes(name.toLowerCase()) &&
      !RANGE_FUNCS.includes(name.toLowerCase()) &&
      name !== 'histogram_quantile' &&
      name !== 'by' &&
      name !== 'without'
    ) {
      facts.metric = name;
      break;
    }
  }

  if (!facts.metric) {
    const bareMetricMatch = working.match(/\b([a-zA-Z_][a-zA-Z0-9_:]*[a-zA-Z0-9_])\b/);
    if (bareMetricMatch) {
      const candidate = bareMetricMatch[1];
      if (
        !AGGREGATIONS.includes(candidate.toLowerCase()) &&
        !RANGE_FUNCS.includes(candidate.toLowerCase()) &&
        candidate !== 'histogram_quantile' &&
        candidate !== 'by' &&
        candidate !== 'without' &&
        candidate !== 'le'
      ) {
        facts.metric = candidate;
      }
    }
  }

  return facts;
}

function describeQuantile(q: number): string {
  return QUANTILE_NAMES[q] || `${q * 100}th percentile`;
}

function describeFunc(func: string): string {
  switch (func) {
    case 'rate':
      return 'per-second rate of';
    case 'irate':
      return 'instant per-second rate of';
    case 'increase':
      return 'increase in';
    case 'delta':
      return 'delta of';
    default:
      if (func.endsWith('_over_time')) {
        const agg = func.replace('_over_time', '');
        return `${agg} over time of`;
      }
      return `${func} of`;
  }
}

function describeComparator(comp: string, value: number): string {
  const word = COMPARATOR_WORDS[comp];
  if (!word) {
    return `${comp} ${value}`;
  }
  return `${word} ${value}`;
}

function describeLabelFilters(matchers: Array<{ label: string; op: string; value: string }>, skipLabels: string[] = []): string {
  const relevant = matchers.filter((m) => !skipLabels.includes(m.label));
  if (relevant.length === 0) {
    return '';
  }
  const parts = relevant.map((m) => `${m.label}${m.op}${m.value}`);
  return `filtered to ${parts.join(', ')}`;
}

export function compileQueryDescription(expr: string, opts?: CompileOpts): CompileResult {
  if (!expr || !expr.trim()) {
    return { text: '', facts: { language: 'unknown' }, confident: true };
  }

  const facts = parseQueryFacts(expr);
  const parts: string[] = [];

  const comp = facts.comparator || opts?.threshold?.comparator;
  const threshVal = facts.threshold ?? opts?.threshold?.value;

  const isHistogram = facts.func === 'histogram_quantile';
  const metricName = isHistogram && facts.metric?.endsWith('_bucket')
    ? facts.metric.slice(0, -'_bucket'.length)
    : facts.metric;

  if (isHistogram && facts.quantile !== undefined) {
    parts.push(`the ${describeQuantile(facts.quantile)} of \`${metricName || 'the metric'}\``);
  } else {
    if (facts.aggregation) {
      parts.push(`the total ${facts.aggregation} of`);
    } else {
      parts.push('');
    }

    if (facts.func && facts.func !== 'histogram_quantile') {
      parts.push(describeFunc(facts.func));
    }

    parts.push(`\`${metricName || expr.trim()}\``);
  }

  if (facts.rangeWindow) {
    parts.push(`over the last ${facts.rangeWindow}`);
  }

  const skipLabels = isHistogram ? ['le'] : [];
  if (facts.labelMatchers && facts.labelMatchers.length > 0) {
    const filterStr = describeLabelFilters(facts.labelMatchers, skipLabels);
    if (filterStr) {
      parts.push(`(${filterStr})`);
    }
  }

  const groupLabels = isHistogram
    ? facts.groupBy?.filter((l) => l !== 'le')
    : facts.groupBy;

  if (groupLabels && groupLabels.length > 0) {
    if (facts.groupByMode === 'without') {
      parts.push(`grouped without ${groupLabels.join(', ')}`);
    } else {
      parts.push(`grouped by ${groupLabels.join(', ')}`);
    }
  }

  if (facts.logLineFilters && facts.logLineFilters.length > 0) {
    const filterDescs = facts.logLineFilters.map((f) => {
      switch (f.op) {
        case '|=':
          return `containing "${f.value}"`;
        case '|~':
          return `matching /${f.value}/`;
        case '!=':
          return `not containing "${f.value}"`;
        case '!~':
          return `not matching /${f.value}/`;
        default:
          return `${f.op} "${f.value}"`;
      }
    });
    parts.push(filterDescs.join(' and '));
  }

  if (comp && threshVal !== undefined) {
    parts.push(describeComparator(comp, threshVal));
  }

  let text = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  if (!text || text === `\`${expr.trim()}\``) {
    return {
      text: `Fires based on the query \`${expr.trim()}\`.`,
      facts,
      confident: false,
    };
  }

  text = `Fires when ${text}.`;

  return { text, facts, confident: true };
}
