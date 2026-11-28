// Mock "slow checkout after deploy v231" scenario. The prototype renders this until it queries real data.

export type AppKey = 'metrics' | 'logs' | 'traces' | 'profiles' | 'sql';

export type ScopeType = 'service' | 'environment' | 'namespace';

export interface Scope {
  type: ScopeType;
  value: string;
}

export type HintSeverity = 'slow' | 'errors' | 'deploy';

export interface Hint {
  id: string;
  severity: HintSeverity;
  title: string;
  description: string;
  scope: Scope;
  // A healthy deploy is worth knowing about but has nothing to investigate.
  investigable: boolean;
  // The signal behind the hint over the last 30 minutes, drawn next to it.
  trendLabel: string;
  trend: number[];
}

const stepTrend = (before: number, after: number) => [
  ...[0.9, 1.1, 1, 0.95, 1.05, 1, 0.9, 1.1, 1, 0.95].map((jitter) => before * jitter),
  ...[1, 0.92, 1.05, 0.96, 1.02, 0.94, 1.04, 0.95, 1.03, 0.97, 1].map((jitter) => after * jitter),
];

// Proactive hints shown below the ask row before the user picks anything. Signals that share a cause
// are one hint: the slow checkout and the payments errors both come from deploy v231.
export const HINTS: Hint[] = [
  {
    id: 'checkout-incident',
    severity: 'slow',
    title: 'checkout is slow and payments errors are up since deploy v231',
    description: 'p95 latency 1.8s, up 480% · 312 payments timeouts · started 14:03',
    scope: { type: 'service', value: 'checkout' },
    investigable: true,
    trendLabel: 'checkout p95 latency',
    trend: stepTrend(1, 5),
  },
  {
    id: 'inventory-deploy',
    severity: 'deploy',
    title: 'inventory deploy v88 rolled out',
    description: 'No change in latency or errors so far',
    scope: { type: 'service', value: 'inventory' },
    investigable: false,
    trendLabel: 'p95 latency',
    trend: stepTrend(1, 1),
  },
];

// Mock label values until the page queries real ones.
export const SCOPE_VALUES: Record<ScopeType, string[]> = {
  service: ['checkout', 'payments', 'inventory', 'notification', 'cart'],
  environment: ['production', 'staging', 'dev'],
  namespace: ['shop', 'payments', 'platform'],
};

// One scale for the hint and service sparklines, so a flat trend looks flat next to a 5x spike.
export const TREND_MAX = 5.5;

export interface ServiceSummary {
  name: string;
  health: 'degraded' | 'healthy';
  p95: string;
  errorRate: string;
  // p95 latency over the last 30 minutes, relative to normal (1 = normal).
  trend: number[];
  lastDeploy: string;
}

// Services the user owns or opened recently, with how they are doing right now.
export const YOUR_SERVICES: ServiceSummary[] = [
  {
    name: 'checkout',
    health: 'degraded',
    p95: '1.8s',
    errorRate: '4.1%',
    trend: stepTrend(1, 5),
    lastDeploy: 'v231 · 14:01',
  },
  {
    name: 'payments',
    health: 'degraded',
    p95: '1.93s',
    errorRate: '6.2%',
    trend: stepTrend(1, 4),
    lastDeploy: 'v118 · yesterday',
  },
  {
    name: 'cart',
    health: 'healthy',
    p95: '120ms',
    errorRate: '0.1%',
    trend: stepTrend(1, 1),
    lastDeploy: 'v57 · 2 days ago',
  },
  {
    name: 'inventory',
    health: 'healthy',
    p95: '210ms',
    errorRate: '0.3%',
    trend: stepTrend(1, 1),
    lastDeploy: 'v88 · 14:20',
  },
];

export interface SignalCoverage {
  app: AppKey;
  question: string;
  // Services the user owns that send this signal, out of all of them.
  covered: number;
  total: number;
  unit: 'services' | 'databases';
  // Services that don't send it yet; a non-empty list makes the signal promote its setup.
  missing: string[];
}

// One experience: each signal is a way into the same data, not a separate app.
export const SIGNALS: SignalCoverage[] = [
  { app: 'metrics', question: 'What changed, without PromQL', covered: 5, total: 5, unit: 'services', missing: [] },
  { app: 'logs', question: 'Patterns and errors, without LogQL', covered: 5, total: 5, unit: 'services', missing: [] },
  { app: 'traces', question: 'Where requests slow down', covered: 5, total: 5, unit: 'services', missing: [] },
  {
    app: 'profiles',
    question: 'Which code uses CPU and memory',
    covered: 3,
    total: 5,
    unit: 'services',
    missing: ['cart', 'notification'],
  },
  { app: 'sql', question: 'Business impact in your data', covered: 2, total: 2, unit: 'databases', missing: [] },
];

// What Grafana Assistant checks, in order, while it works out what is wrong.
export const DETECTION_STEPS: Array<{ app: AppKey; finding: string }> = [
  { app: 'metrics', finding: 'p95 latency up 480% since deploy v231' },
  { app: 'logs', finding: 'New timeout pattern, 312 occurrences' },
  { app: 'traces', finding: 'payments.charge is 900ms slower' },
  { app: 'profiles', finding: 'encode() uses 22% more CPU' },
  { app: 'sql', finding: 'Failed orders up 3x, slow SELECT on payments' },
];

export const DETECTED_SCOPE = {
  environment: 'production',
  since: 'deploy v231 · 14:01',
  likelyCause:
    'Deploy v231 made payments.charge about 900ms slower, split between extra CPU in encode() and a slow SELECT on payments.',
};

export interface InsightSummary {
  app: AppKey;
  label: string;
  value: string;
  change: string;
  trend: number[];
}

export const INSIGHTS: InsightSummary[] = [
  { app: 'metrics', label: 'p95 latency', value: '1.8s', change: '+480% since deploy v231', trend: stepTrend(1, 5) },
  { app: 'logs', label: 'Error logs', value: '312', change: '+4x since deploy v231', trend: stepTrend(1, 4) },
  {
    app: 'traces',
    label: 'Slowest span',
    value: 'payments.charge',
    change: '+900ms since deploy v231',
    trend: stepTrend(1, 4),
  },
  {
    app: 'profiles',
    label: 'Top function',
    value: 'encode()',
    change: '38% of CPU, +22% since deploy v231',
    trend: stepTrend(1, 3),
  },
  { app: 'sql', label: 'Failed orders', value: '1.2k / h', change: '3x since deploy v231', trend: stepTrend(1, 3) },
];

// Request duration per minute, in seconds. The deploy lands at DEPLOY_INDEX.
export const DEPLOY_INDEX = 18;
export const REQUEST_DURATION = [
  0.32, 0.36, 0.3, 0.38, 0.33, 0.37, 0.31, 0.35, 0.39, 0.32, 0.36, 0.3, 0.38, 0.34, 0.31, 0.37, 0.33, 0.39, 1.6, 1.8,
  1.45, 1.7, 1.4, 1.6, 1.75, 1.5, 1.65, 1.78, 1.5, 1.7, 1.4, 1.62, 1.76, 1.44, 1.6, 1.8,
];

export type LogLevel = 'error' | 'warn' | 'info';

export const LOG_LINES: Array<{ time: string; level: LogLevel; message: string }> = [
  { time: '14:02:11', level: 'error', message: 'payments timeout 900ms' },
  { time: '14:02:10', level: 'warn', message: 'retry payments.charge 2/3' },
  { time: '14:02:08', level: 'error', message: 'payments timeout 912ms' },
  { time: '14:02:06', level: 'info', message: 'POST /checkout 200 1.7s' },
  { time: '14:01:58', level: 'info', message: 'deploy v231 rolled out' },
  { time: '14:01:55', level: 'error', message: 'payments timeout 905ms' },
  { time: '14:01:52', level: 'warn', message: 'retry payments.charge 1/3' },
  { time: '14:01:49', level: 'error', message: 'payments timeout 898ms' },
  { time: '14:01:44', level: 'info', message: 'POST /checkout 200 1.6s' },
];

export type SpanColor = 'blue' | 'orange' | 'green' | 'purple';

export const TRACE = {
  name: 'POST /checkout',
  durationMs: 2410,
  axisTicks: ['0', '0.8s', '1.6s', '2.4s'],
  summary: 'payments.charge accounts for 80% of the request, split between encode() and a slow SELECT.',
  spans: [
    { service: 'checkout', operation: 'POST /checkout', depth: 0, startMs: 0, durationMs: 2410, color: 'blue' },
    { service: 'checkout', operation: 'validate cart', depth: 1, startMs: 24, durationMs: 40, color: 'blue' },
    { service: 'payments', operation: 'POST /charge', depth: 1, startMs: 167, durationMs: 1930, color: 'orange' },
    { service: 'payments', operation: 'encode()', depth: 2, startMs: 239, durationMs: 820, color: 'orange' },
    { service: 'payments', operation: 'SELECT payments', depth: 2, startMs: 1074, durationMs: 840, color: 'orange' },
    { service: 'inventory', operation: 'reserve items', depth: 1, startMs: 2124, durationMs: 120, color: 'green' },
    { service: 'notification', operation: 'send receipt', depth: 1, startMs: 2267, durationMs: 60, color: 'purple' },
  ] satisfies Array<{
    service: string;
    operation: string;
    depth: number;
    startMs: number;
    durationMs: number;
    color: SpanColor;
  }>,
  // Spans slower than this are highlighted as part of the regression.
  slowThresholdMs: 500,
};

export type FlameColor = 'blue' | 'orange' | 'purple' | 'red';

// Each frame is [start, width] as a fraction of the total, per level.
export const FLAME_GRAPH: {
  levels: Array<Array<{ start: number; width: number; color: FlameColor; name: string }>>;
  path: string[];
} = {
  levels: [
    [{ start: 0, width: 1, color: 'blue', name: 'checkout' }],
    [
      { start: 0, width: 0.66, color: 'orange', name: 'payments.charge' },
      { start: 0.677, width: 0.323, color: 'purple', name: 'cart.render' },
    ],
    [
      { start: 0, width: 0.473, color: 'orange', name: 'encode()' },
      { start: 0.487, width: 0.173, color: 'purple', name: 'json.marshal' },
      { start: 0.677, width: 0.189, color: 'orange', name: 'template.exec' },
    ],
    [
      { start: 0, width: 0.378, color: 'red', name: 'base64.encode' },
      { start: 0.391, width: 0.082, color: 'orange', name: 'hash' },
      { start: 0.677, width: 0.126, color: 'purple', name: 'io.write' },
    ],
    [{ start: 0, width: 0.302, color: 'red', name: 'runtime.mallocgc' }],
  ],
  path: ['checkout', 'payments.charge', 'encode()'],
};

export const FAILED_ORDERS = [
  { orderId: 'ord_88231', amount: '€ 64.20', status: 'failed', time: '14:02' },
  { orderId: 'ord_88229', amount: '€ 18.90', status: 'failed', time: '14:02' },
  { orderId: 'ord_88226', amount: '€ 112.00', status: 'failed', time: '14:01' },
  { orderId: 'ord_88220', amount: '€ 39.50', status: 'failed', time: '14:01' },
  { orderId: 'ord_88217', amount: '€ 72.10', status: 'failed', time: '14:00' },
];

export const SLOW_QUERIES = [
  { query: 'SELECT … FROM payments WHERE order_id = ?', p95: '840ms' },
  { query: 'UPDATE orders SET status = ? WHERE id = ?', p95: '310ms' },
  { query: 'SELECT … FROM carts WHERE session = ?', p95: '95ms' },
];
