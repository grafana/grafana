// Temporary dev-only mock for the deep search endpoint, so the palette UI can
// be iterated without a configured vector backend.
// Enable in a dev build via: localStorage.setItem('grafana.dev.deepSearchMock', 'true')
// TODO: remove this file (and its two call sites) before merging.
import { store } from '@grafana/data';
import { config } from '@grafana/runtime';

import { type DeepSearchPanelResult } from './deepSearch';

const MOCK_FLAG_KEY = 'grafana.dev.deepSearchMock';

export function isDeepSearchMockEnabled(): boolean {
  return config.buildInfo.env === 'development' && store.getBool(MOCK_FLAG_KEY, false);
}

export async function mockSearchDashboardVector(query: string, limit = 40): Promise<DeepSearchPanelResult[]> {
  // Simulate realistic vector search latency to exercise the loading bar
  await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 400));

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2);

  const matches =
    terms.length === 0
      ? []
      : MOCK_CORPUS.filter((hit) =>
          terms.some(
            (term) => hit.content.toLowerCase().includes(term) || hit.dashboardTitle.toLowerCase().includes(term)
          )
        );

  return [...matches].sort((a, b) => a.score - b.score).slice(0, limit);
}

const MOCK_CORPUS: DeepSearchPanelResult[] = [
  // API latency — 3 panels
  {
    dashboardUid: 'mock-api-latency',
    dashboardTitle: 'API latency overview',
    folderTitle: 'Observability',
    folderUid: 'mock-folder-obs',
    panelId: 2,
    content:
      'p99 latency by region — histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, region))',
    language: 'promql',
    score: 0.12,
  },
  {
    dashboardUid: 'mock-api-latency',
    dashboardTitle: 'API latency overview',
    folderTitle: 'Observability',
    folderUid: 'mock-folder-obs',
    panelId: 5,
    content: 'p50 / p95 request latency per endpoint with SLO threshold annotations',
    language: 'promql',
    score: 0.18,
  },
  {
    dashboardUid: 'mock-api-latency',
    dashboardTitle: 'API latency overview',
    folderTitle: 'Observability',
    folderUid: 'mock-folder-obs',
    panelId: 9,
    rowName: 'Upstreams',
    content: 'Upstream service latency heatmap — grpc_server_handling_seconds',
    language: 'promql',
    score: 0.27,
  },
  // Checkout service — 2 panels
  {
    dashboardUid: 'mock-checkout',
    dashboardTitle: 'Checkout service',
    folderTitle: 'E-commerce',
    folderUid: 'mock-folder-shop',
    panelId: 1,
    content: 'Checkout errors by status code — sum(rate(checkout_errors_total[5m])) by (code)',
    language: 'promql',
    score: 0.15,
  },
  {
    dashboardUid: 'mock-checkout',
    dashboardTitle: 'Checkout service',
    folderTitle: 'E-commerce',
    folderUid: 'mock-folder-shop',
    panelId: 4,
    content: 'Payment provider latency and timeout rate per provider',
    language: 'promql',
    score: 0.31,
  },
  // Kubernetes cluster — 3 panels
  {
    dashboardUid: 'mock-k8s',
    dashboardTitle: 'Kubernetes / Compute resources',
    folderTitle: 'Infrastructure',
    folderUid: 'mock-folder-infra',
    panelId: 3,
    content: 'CPU usage by namespace — sum(rate(container_cpu_usage_seconds_total[5m])) by (namespace)',
    language: 'promql',
    score: 0.1,
  },
  {
    dashboardUid: 'mock-k8s',
    dashboardTitle: 'Kubernetes / Compute resources',
    folderTitle: 'Infrastructure',
    folderUid: 'mock-folder-infra',
    panelId: 7,
    content: 'Memory working set vs requests and limits per pod',
    language: 'promql',
    score: 0.22,
  },
  {
    dashboardUid: 'mock-k8s',
    dashboardTitle: 'Kubernetes / Compute resources',
    folderTitle: 'Infrastructure',
    folderUid: 'mock-folder-infra',
    panelId: 11,
    rowName: 'Network',
    content: 'Network receive/transmit bandwidth by pod',
    language: 'promql',
    score: 0.4,
  },
  // Postgres — 2 panels
  {
    dashboardUid: 'mock-postgres',
    dashboardTitle: 'PostgreSQL overview',
    folderTitle: 'Databases',
    folderUid: 'mock-folder-db',
    panelId: 2,
    content: 'Slow queries and lock waits — pg_stat_activity wait events over time',
    language: 'sql',
    score: 0.2,
  },
  {
    dashboardUid: 'mock-postgres',
    dashboardTitle: 'PostgreSQL overview',
    folderTitle: 'Databases',
    folderUid: 'mock-folder-db',
    panelId: 6,
    content: 'Connection pool saturation, transactions per second, cache hit ratio',
    language: 'sql',
    score: 0.33,
  },
  // Loki — point at real local dashboards (created for dev) so clicking navigates
  {
    dashboardUid: 'loki-logs',
    dashboardTitle: 'Loki logs overview',
    panelId: 1,
    content: 'Error log rate by service — sum(rate({cluster="prod"} |= "error" [5m])) by (service)',
    language: 'logql',
    score: 0.17,
  },
  {
    dashboardUid: 'loki-logs',
    dashboardTitle: 'Loki logs overview',
    panelId: 2,
    content: 'Log volume by namespace — loki ingestion rate and distributor errors',
    language: 'logql',
    score: 0.36,
  },
  {
    dashboardUid: 'loki-perf',
    dashboardTitle: 'Loki performance',
    panelId: 1,
    content: 'Loki query latency p99 and ingester memory working set',
    language: 'promql',
    score: 0.25,
  },
  // Business KPIs — 1 panel
  {
    dashboardUid: 'mock-kpi',
    dashboardTitle: 'Business KPIs',
    folderTitle: 'Leadership',
    folderUid: 'mock-folder-lead',
    panelId: 1,
    content: 'Daily active users, conversion rate and revenue per region',
    language: 'sql',
    score: 0.45,
  },
];
