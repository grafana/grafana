// Prototype-only mock catalog. Not internationalized.
// All numbers are hand-authored so live demos read plausibly.

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface MockLabel {
  name: string;
  cardinality: number; // distinct value count
  values: string[]; // sample values (not necessarily all `cardinality` of them)
}

export interface MockMetric {
  name: string;
  type: MetricType;
  help: string;
  activeSeries: number;
  scrapeIntervalSec: number;
  lastScrapedSecondsAgo: number;
  labels: MockLabel[];
  // gauges only
  currentValue?: number;
  unit?: string;
  sparkline?: number[]; // ~20 points
  // histograms/summaries only
  quantiles?: { p50: number; p90: number; p99: number };
}

export const MOCK_METRICS: MockMetric[] = [
  {
    name: 'http_server_requests_seconds_bucket',
    type: 'histogram',
    help: 'HTTP request latency distribution in seconds.',
    activeSeries: 4820,
    scrapeIntervalSec: 15,
    lastScrapedSecondsAgo: 4,
    quantiles: { p50: 0.021, p90: 0.184, p99: 0.612 },
    labels: [
      {
        name: 'le',
        cardinality: 12,
        values: ['0.005', '0.01', '0.025', '0.05', '0.1', '0.25', '0.5', '1', '2.5', '5', '10', '+Inf'],
      },
      { name: 'method', cardinality: 5, values: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
      { name: 'status', cardinality: 8, values: ['200', '201', '204', '301', '400', '401', '404', '500'] },
      {
        name: 'route',
        cardinality: 42,
        values: ['/api/v1/users', '/api/v1/orgs', '/api/v1/dashboards', '/api/v1/datasources', '/api/health'],
      },
      { name: 'instance', cardinality: 24, values: ['prod-api-01:9090', 'prod-api-02:9090', 'prod-api-03:9090'] },
    ],
  },
  {
    name: 'http_server_requests_seconds_count',
    type: 'counter',
    help: 'Total number of HTTP requests observed.',
    activeSeries: 402,
    scrapeIntervalSec: 15,
    lastScrapedSecondsAgo: 4,
    labels: [
      { name: 'method', cardinality: 5, values: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
      { name: 'status', cardinality: 8, values: ['200', '201', '204', '301', '400', '401', '404', '500'] },
      {
        name: 'route',
        cardinality: 42,
        values: ['/api/v1/users', '/api/v1/orgs', '/api/v1/dashboards', '/api/v1/datasources'],
      },
      { name: 'instance', cardinality: 24, values: ['prod-api-01:9090', 'prod-api-02:9090', 'prod-api-03:9090'] },
    ],
  },
  {
    name: 'http_server_requests_seconds_sum',
    type: 'counter',
    help: 'Sum of HTTP request latencies in seconds.',
    activeSeries: 402,
    scrapeIntervalSec: 15,
    lastScrapedSecondsAgo: 4,
    labels: [
      { name: 'method', cardinality: 5, values: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
      { name: 'status', cardinality: 8, values: ['200', '201', '204', '301', '400', '401', '404', '500'] },
      { name: 'route', cardinality: 42, values: ['/api/v1/users', '/api/v1/orgs'] },
    ],
  },
  {
    name: 'node_cpu_seconds_total',
    type: 'counter',
    help: 'Seconds the CPUs spent in each mode.',
    activeSeries: 1920,
    scrapeIntervalSec: 15,
    lastScrapedSecondsAgo: 6,
    labels: [
      { name: 'cpu', cardinality: 16, values: ['0', '1', '2', '3', '4', '5', '6', '7'] },
      { name: 'mode', cardinality: 8, values: ['idle', 'user', 'system', 'iowait', 'irq', 'softirq', 'nice', 'steal'] },
      { name: 'instance', cardinality: 15, values: ['node-01:9100', 'node-02:9100', 'node-03:9100', 'node-04:9100'] },
      { name: 'job', cardinality: 3, values: ['node-exporter', 'kubernetes-nodes', 'baremetal'] },
    ],
  },
  {
    name: 'node_memory_MemAvailable_bytes',
    type: 'gauge',
    help: 'Memory available on the host in bytes.',
    activeSeries: 15,
    scrapeIntervalSec: 15,
    lastScrapedSecondsAgo: 3,
    currentValue: 6_842_351_616,
    unit: 'bytes',
    sparkline: [6.9, 6.8, 6.7, 6.7, 6.9, 7.0, 6.9, 6.8, 6.7, 6.6, 6.7, 6.8, 6.9, 6.9, 6.8, 6.7, 6.9, 6.8, 6.9, 6.8],
    labels: [
      { name: 'instance', cardinality: 15, values: ['node-01:9100', 'node-02:9100', 'node-03:9100'] },
      { name: 'job', cardinality: 2, values: ['node-exporter', 'kubernetes-nodes'] },
    ],
  },
  {
    name: 'node_memory_MemTotal_bytes',
    type: 'gauge',
    help: 'Total memory installed on the host in bytes.',
    activeSeries: 15,
    scrapeIntervalSec: 15,
    lastScrapedSecondsAgo: 3,
    currentValue: 16_777_216_000,
    unit: 'bytes',
    sparkline: [
      16.7, 16.7, 16.7, 16.7, 16.7, 16.7, 16.7, 16.7, 16.7, 16.7, 16.7, 16.7, 16.7, 16.7, 16.7, 16.7, 16.7, 16.7, 16.7,
      16.7,
    ],
    labels: [
      { name: 'instance', cardinality: 15, values: ['node-01:9100', 'node-02:9100', 'node-03:9100'] },
      { name: 'job', cardinality: 2, values: ['node-exporter', 'kubernetes-nodes'] },
    ],
  },
  {
    name: 'process_resident_memory_bytes',
    type: 'gauge',
    help: 'Resident memory size of the process in bytes.',
    activeSeries: 84,
    scrapeIntervalSec: 15,
    lastScrapedSecondsAgo: 2,
    currentValue: 412_450_816,
    unit: 'bytes',
    sparkline: [380, 390, 395, 402, 410, 415, 412, 408, 405, 411, 418, 420, 415, 410, 412, 414, 411, 412, 413, 412],
    labels: [
      { name: 'instance', cardinality: 42, values: ['prod-api-01:9090', 'prod-api-02:9090', 'prod-web-01:9090'] },
      { name: 'job', cardinality: 6, values: ['grafana', 'prometheus', 'alertmanager', 'node-exporter'] },
    ],
  },
  {
    name: 'process_cpu_seconds_total',
    type: 'counter',
    help: 'Total user and system CPU time consumed by the process.',
    activeSeries: 84,
    scrapeIntervalSec: 15,
    lastScrapedSecondsAgo: 2,
    labels: [
      { name: 'instance', cardinality: 42, values: ['prod-api-01:9090', 'prod-api-02:9090'] },
      { name: 'job', cardinality: 6, values: ['grafana', 'prometheus', 'alertmanager'] },
    ],
  },
  {
    name: 'grpc_server_handled_total',
    type: 'counter',
    help: 'Total number of gRPC RPCs completed on the server.',
    activeSeries: 612,
    scrapeIntervalSec: 15,
    lastScrapedSecondsAgo: 5,
    labels: [
      {
        name: 'grpc_service',
        cardinality: 18,
        values: ['grafana.QueryService', 'grafana.AuthService', 'grafana.DashboardService'],
      },
      { name: 'grpc_method', cardinality: 44, values: ['Query', 'Login', 'GetDashboard', 'ListFolders'] },
      {
        name: 'grpc_code',
        cardinality: 12,
        values: ['OK', 'Canceled', 'InvalidArgument', 'DeadlineExceeded', 'NotFound', 'Internal'],
      },
      { name: 'instance', cardinality: 12, values: ['prod-grpc-01:8443', 'prod-grpc-02:8443'] },
    ],
  },
  {
    name: 'grpc_server_handling_seconds_bucket',
    type: 'histogram',
    help: 'gRPC handler latency distribution in seconds.',
    activeSeries: 8140,
    scrapeIntervalSec: 15,
    lastScrapedSecondsAgo: 5,
    quantiles: { p50: 0.008, p90: 0.042, p99: 0.187 },
    labels: [
      { name: 'le', cardinality: 12, values: ['0.005', '0.01', '0.025', '0.05', '0.1', '0.25', '0.5', '1', '+Inf'] },
      { name: 'grpc_service', cardinality: 18, values: ['grafana.QueryService', 'grafana.AuthService'] },
      { name: 'grpc_method', cardinality: 44, values: ['Query', 'Login', 'GetDashboard'] },
      { name: 'instance', cardinality: 12, values: ['prod-grpc-01:8443', 'prod-grpc-02:8443'] },
    ],
  },
  {
    name: 'go_goroutines',
    type: 'gauge',
    help: 'Number of goroutines that currently exist.',
    activeSeries: 84,
    scrapeIntervalSec: 15,
    lastScrapedSecondsAgo: 2,
    currentValue: 217,
    sparkline: [201, 205, 210, 215, 220, 218, 215, 212, 217, 222, 225, 220, 218, 215, 217, 219, 221, 217, 215, 217],
    labels: [
      { name: 'instance', cardinality: 42, values: ['prod-api-01:9090', 'prod-api-02:9090'] },
      { name: 'job', cardinality: 6, values: ['grafana', 'prometheus', 'alertmanager'] },
    ],
  },
  {
    name: 'go_gc_duration_seconds',
    type: 'summary',
    help: 'A summary of the pause duration of garbage collection cycles.',
    activeSeries: 336,
    scrapeIntervalSec: 15,
    lastScrapedSecondsAgo: 2,
    quantiles: { p50: 0.00012, p90: 0.00048, p99: 0.00214 },
    labels: [
      { name: 'quantile', cardinality: 5, values: ['0', '0.25', '0.5', '0.75', '1'] },
      { name: 'instance', cardinality: 42, values: ['prod-api-01:9090', 'prod-api-02:9090'] },
      { name: 'job', cardinality: 6, values: ['grafana', 'prometheus'] },
    ],
  },
  {
    name: 'go_memstats_heap_inuse_bytes',
    type: 'gauge',
    help: 'Number of heap bytes that are in use.',
    activeSeries: 84,
    scrapeIntervalSec: 15,
    lastScrapedSecondsAgo: 2,
    currentValue: 89_128_960,
    unit: 'bytes',
    sparkline: [82, 84, 86, 88, 90, 89, 87, 85, 88, 91, 93, 90, 88, 86, 88, 90, 89, 88, 87, 89],
    labels: [
      { name: 'instance', cardinality: 42, values: ['prod-api-01:9090', 'prod-api-02:9090'] },
      { name: 'job', cardinality: 6, values: ['grafana', 'prometheus'] },
    ],
  },
  {
    name: 'up',
    type: 'gauge',
    help: '1 if the instance is up and scrape succeeded, otherwise 0.',
    activeSeries: 148,
    scrapeIntervalSec: 15,
    lastScrapedSecondsAgo: 1,
    currentValue: 1,
    sparkline: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    labels: [
      { name: 'instance', cardinality: 148, values: ['prod-api-01:9090', 'prod-api-02:9090', 'node-01:9100'] },
      { name: 'job', cardinality: 12, values: ['grafana', 'prometheus', 'node-exporter', 'alertmanager'] },
    ],
  },
  {
    name: 'prometheus_tsdb_head_series',
    type: 'gauge',
    help: 'Total number of series in the head block.',
    activeSeries: 4,
    scrapeIntervalSec: 15,
    lastScrapedSecondsAgo: 1,
    currentValue: 1_842_310,
    sparkline: [
      1800, 1810, 1815, 1820, 1825, 1830, 1832, 1835, 1838, 1840, 1841, 1842, 1842, 1842, 1842, 1842, 1842, 1842, 1842,
      1842,
    ],
    labels: [
      { name: 'instance', cardinality: 4, values: ['prometheus-01:9090', 'prometheus-02:9090'] },
      { name: 'job', cardinality: 1, values: ['prometheus'] },
    ],
  },
  {
    name: 'kube_pod_container_status_running',
    type: 'gauge',
    help: 'Describes whether the container is currently in running state.',
    activeSeries: 3218,
    scrapeIntervalSec: 30,
    lastScrapedSecondsAgo: 11,
    currentValue: 1,
    sparkline: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    labels: [
      {
        name: 'namespace',
        cardinality: 62,
        values: ['default', 'kube-system', 'monitoring', 'grafana', 'ingress-nginx'],
      },
      { name: 'pod', cardinality: 1840, values: ['grafana-7f9b5c8d-abc12', 'prometheus-0', 'node-exporter-xyz'] },
      { name: 'container', cardinality: 148, values: ['grafana', 'prometheus', 'node-exporter', 'sidecar'] },
      { name: 'node', cardinality: 24, values: ['node-01', 'node-02', 'node-03'] },
    ],
  },
  {
    name: 'container_memory_usage_bytes',
    type: 'gauge',
    help: 'Current memory usage in bytes for a container.',
    activeSeries: 12_460,
    scrapeIntervalSec: 15,
    lastScrapedSecondsAgo: 3,
    currentValue: 268_435_456,
    unit: 'bytes',
    sparkline: [250, 258, 262, 268, 275, 272, 269, 265, 270, 278, 282, 279, 275, 270, 268, 272, 275, 270, 268, 268],
    labels: [
      { name: 'namespace', cardinality: 62, values: ['default', 'kube-system', 'monitoring', 'grafana'] },
      { name: 'pod', cardinality: 1840, values: ['grafana-7f9b5c8d-abc12', 'prometheus-0'] },
      { name: 'container', cardinality: 148, values: ['grafana', 'prometheus', 'sidecar'] },
      { name: 'image', cardinality: 210, values: ['grafana/grafana:11.0.0', 'prom/prometheus:v2.51.0'] },
    ],
  },
  {
    name: 'alertmanager_notifications_total',
    type: 'counter',
    help: 'Total number of attempted notifications.',
    activeSeries: 32,
    scrapeIntervalSec: 30,
    lastScrapedSecondsAgo: 8,
    labels: [
      { name: 'integration', cardinality: 8, values: ['slack', 'pagerduty', 'email', 'webhook', 'opsgenie'] },
      { name: 'instance', cardinality: 4, values: ['alertmanager-01:9093', 'alertmanager-02:9093'] },
    ],
  },
];

export function findMetric(name: string): MockMetric | undefined {
  return MOCK_METRICS.find((m) => m.name === name);
}

// Find whichever known metric appears in the expr. Works for bare metric
// names, `metric{…}` selectors, and wrapped expressions like
// `rate(metric[5m])` or `sum(rate(metric{…}[5m])) by (le)`. Returns the
// first matching known metric name, or null if none is referenced.
export function detectMetricInExpr(expr: string): MockMetric | null {
  if (!expr) {
    return null;
  }
  for (const m of MOCK_METRICS) {
    // Match the metric name as a whole PromQL identifier — bounded by non-identifier chars.
    const re = new RegExp(`(?:^|[^a-zA-Z0-9_:])${escapeRegExp(m.name)}(?:$|[^a-zA-Z0-9_:])`);
    if (re.test(expr)) {
      return m;
    }
  }
  return null;
}

// True when the expr is JUST a bare metric name (no braces, no wrappers) — the
// signal we use to decide whether to nudge the user toward rate()/increase().
export function isBareMetric(expr: string): MockMetric | null {
  const trimmed = expr.trim();
  const m = MOCK_METRICS.find((mm) => mm.name === trimmed);
  return m ?? null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Sorted descending by cardinality, so callers can render "top labels driving series count".
export function topCardinalityLabels(metric: MockMetric, n = 3): MockLabel[] {
  return [...metric.labels].sort((a, b) => b.cardinality - a.cardinality).slice(0, n);
}

// Naive estimate: baseline series count scaled down by each filter's selectivity.
// Prototype-only. Real Prometheus would be much more complex.
export function estimateMatchingSeries(metricName: string, filters: Array<{ label: string; value: string }>): number {
  const metric = findMetric(metricName);
  if (!metric) {
    return 0;
  }
  let count = metric.activeSeries;
  for (const f of filters) {
    const label = metric.labels.find((l) => l.name === f.label);
    if (!label || label.cardinality === 0) {
      continue;
    }
    // Assume uniform distribution: each equality filter divides series by cardinality.
    count = Math.max(1, Math.round(count / label.cardinality));
  }
  return count;
}
