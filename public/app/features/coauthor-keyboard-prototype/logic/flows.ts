// Scripted content for the three keyboard-popover flows. All mocked.

export const AI_PURPLE = '#d187f5';

export const TOPK_QUERY =
  'topk(5, sum by(path, service_name) (rate(server_requests_duration_seconds_sum[5m])) / sum by(path, service_name) (rate(server_requests_duration_seconds_count[5m])))';

export const F2_EMPTY = '';
export const F2_PLACEHOLDER = 'Enter PromQL or type / + space to query in natural language';

export const F3_START = 'sum by(path) (rate(server_request_duration_seconds_bucket[5m]))';
export const F3_ACCEPTED =
  'histogram_quantile(0.95, sum by(path, le) (rate(server_request_duration_seconds_bucket[5m])))';

export interface Suggestion {
  name: string;
  desc: string;
}

/** A node in a simple left-to-right query-flow visualization. */
export interface FlowLiteNode {
  category: string;
  value: string;
  tone?: 'default' | 'green' | 'blue';
}

/** A run of query text that is either committed (real) or a faded proposal. */
export interface PreviewSegment {
  text: string;
  proposed: boolean;
  /** Proposals default to muted; 'blue' marks a pending, acceptable change. */
  tone?: 'muted' | 'blue';
}

// ---- Flow 1 (highlight) --------------------------------------------------
interface Flow1Data {
  summary: string;
  explainMore: string;
  swapFunction: Suggestion[];
  swapMetric: Suggestion[];
  changeWindow: Suggestion[];
}

export const FLOW1: Flow1Data = {
  summary: 'Total request time, per second, over the last 5 min',
  explainMore:
    'This is the numerator of an average-latency calculation: rate() turns the cumulative _sum counter into a per-second value over a 5-minute window. Divided by the matching _count, it yields average request duration per path.',
  swapFunction: [
    { name: 'irate', desc: 'Uses last 2 data points to catch short spikes, best for debugging' },
    { name: 'increase', desc: 'Total over window, instead of ongoing rate' },
  ],
  swapMetric: [
    { name: 'server_requests_duration_seconds_count', desc: 'Total of requests, not how long' },
    { name: 'server_requests_duration_seconds_bucket', desc: 'See full spread, not just the average' },
  ],
  changeWindow: [
    { name: '[1m]', desc: 'React faster to changes' },
    { name: '[15m]/[1h]', desc: 'Smooth out noise' },
  ],
};

/** Windows can carry a compound label like "[15m]/[1h]" — apply the first one. */
export function windowValue(label: string): string {
  const first = label.match(/\[[^\]]+\]/);
  return first ? first[0] : label;
}

/** "use a bucket metric" and similar free-text in the main highlight popover. */
export function interpretHighlightText(text: string): { kind: 'metric' | 'function' | 'window'; value: string } | null {
  const t = text.toLowerCase();
  if (/bucket/.test(t)) {
    return { kind: 'metric', value: 'server_requests_duration_seconds_bucket' };
  }
  if (/count|how many|number/.test(t)) {
    return { kind: 'metric', value: 'server_requests_duration_seconds_count' };
  }
  if (/irate|spike|debug/.test(t)) {
    return { kind: 'function', value: 'irate' };
  }
  if (/increase|total over/.test(t)) {
    return { kind: 'function', value: 'increase' };
  }
  if (/1m|faster|react/.test(t)) {
    return { kind: 'window', value: '[1m]' };
  }
  if (/15m|1h|smooth|noise/.test(t)) {
    return { kind: 'window', value: '[15m]' };
  }
  return null;
}

// ---- Flow 2 (from scratch) -----------------------------------------------
export const FLOW2 = {
  datasourceSummary:
    'This datasource tracks request traffic, errors and latency for checkout-service, auth-service, and search-service.',
  explainMore:
    'grafanacloud-dev-prom exposes three services (checkout-service, auth-service, search-service). Key metrics: server_requests_total (counter), server_requests_duration_seconds (histogram with _sum/_count/_bucket), and up (gauge). Labels: path, service_name, status_code.',
  chips: [
    {
      label: 'Latency',
      query: 'histogram_quantile(0.95, sum by(le, path) (rate(server_requests_duration_seconds_bucket[5m])))',
      why: 'p95 request duration per path, estimated from histogram buckets — the latency most requests stay under.',
      flow: [
        { category: 'HISTOGRAM', value: 'server_requests_duration...' },
        { category: 'FUNCTION', value: 'rate 5m' },
        { category: 'FUNCTION', value: 'sum by(le, path)' },
        { category: 'FUNCTION', value: 'histogram_quantile 0.95' },
      ],
    },
    {
      label: 'Request rate',
      query: 'sum by(path) (rate(server_requests_total[5m]))',
      why: 'Per-second request rate per path, summed across instances.',
      flow: [
        { category: 'COUNTER', value: 'server_requests_total' },
        { category: 'FUNCTION', value: 'rate 5m' },
        { category: 'FUNCTION', value: 'sum by(path)' },
      ],
    },
    {
      label: 'Errors by endpoint',
      query: 'sum by(path) (rate(server_requests_total{status_code=~"5.."}[5m]))',
      why: 'Per-second rate of 5xx responses, grouped by path.',
      flow: [
        { category: 'COUNTER', value: 'server_requests_total{5xx}' },
        { category: 'FUNCTION', value: 'rate 5m' },
        { category: 'FUNCTION', value: 'sum by(path)' },
      ],
    },
  ],
  // Natural-language prompt result
  prompt: 'I want a panel that tells me if the checkout service is up/down',
  promptResult: {
    query: 'up{service_name="checkout-service"}',
    why: 'up is Prometheus’ built-in reachability signal. Filtering to checkout-service isolates the panel to the one service’s status.',
  },
};

// ---- Flow 3 (mid-query) --------------------------------------------------
export const FLOW3 = {
  looksLike: 'latency by path',
  reasoning:
    'The query rates a histogram’s _bucket series and groups by path — a latency shape. histogram_quantile needs the le label in the grouping, and wrapping it turns the raw bucket rates into a p95 line: the latency most requests actually stay under.',
  suggestions: {
    le: {
      title: 'Fix error',
      detail: 'Add le to compute sum by',
    },
    hq: {
      title: 'Add function',
      detail: 'Updates query to represent what most requests actually experience',
    },
  },
};

// F3_START with the two proposed additions (histogram_quantile wrapper + le)
// shown as faded proposals inside the real query.
export const F3_PREVIEW: PreviewSegment[] = [
  { text: 'histogram_quantile(0.95, ', proposed: true },
  { text: 'sum by(path', proposed: false },
  { text: ', le', proposed: true },
  { text: ') (rate(server_request_duration_seconds_bucket[5m]))', proposed: false },
  { text: ')', proposed: true },
];

// ---- Flow 4 (pasted query) -----------------------------------------------
export interface ModifySuggestion {
  id: string;
  label: string;
  title: string;
  detail: string;
  query: string;
}

export const FLOW4 = {
  pastedQuery: TOPK_QUERY,
  looksLike: 'top 5 slowest paths by average latency',
  reasoning:
    'This divides total request duration by request count per path to get average latency, then keeps the 5 highest. It’s already a complete, valid query — the suggestions are optional refinements, not fixes.',
  flow: [
    { category: 'HISTOGRAM', value: 'server_requests_duration...' },
    { category: 'FUNCTION', value: 'rate 5m' },
    { category: 'FUNCTION', value: 'sum by(path)' },
    { category: 'FUNCTION', value: '÷ count → avg' },
    { category: 'FUNCTION', value: 'topk 5' },
  ],
  suggestions: [
    {
      id: 'p95',
      label: 'Cheaper alternative query',
      title: 'p95 instead of average',
      detail: 'Averaging hides outliers. See the latency of the slowest requests.',
      query:
        'topk(5, histogram_quantile(0.95, sum by(le, path, service_name) (rate(server_requests_duration_seconds_bucket[5m]))))',
    },
    {
      id: 'scope',
      label: 'Narrow results',
      title: 'Scope to specific service',
      detail: 'Filter to the slowest paths of a specific service you care about, rather than any service anywhere.',
      query:
        'topk(5, sum by(path, service_name) (rate(server_requests_duration_seconds_sum{service_name="checkout-service"}[5m])) / sum by(path, service_name) (rate(server_requests_duration_seconds_count{service_name="checkout-service"}[5m])))',
    },
  ],
};

/** NL modify for a complete (pasted) query. */
export function interpretModify4(text: string): string | null {
  const t = text.toLowerCase();
  if (/p9\d|percentile|quantile|outlier|tail/.test(t)) {
    return FLOW4.suggestions[0].query;
  }
  if (/scope|service|checkout|auth|search|narrow|filter/.test(t)) {
    return FLOW4.suggestions[1].query;
  }
  return null;
}
