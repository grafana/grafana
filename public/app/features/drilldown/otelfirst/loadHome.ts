import { type InstantSample, lokiLabelValues, promInstant, tempoTagValues } from '../realdata/labApi';
import { formatMs } from '../realdata/loadScenario';

const CALLS = 'traces_span_metrics_calls_total';
const BUCKET = 'traces_span_metrics_duration_milliseconds_bucket';
const SERVER = 'span_kind="SPAN_KIND_SERVER"';
const ERROR = 'status_code="STATUS_CODE_ERROR"';
// flagd keeps one streaming RPC open for minutes, which would top every latency ranking.
const NO_STREAMS = 'span_name!~".*EventStream.*"';
const WINDOW_S = 1800;
const ERROR_RATE_LIMIT = 0.01;
const SLOW_RATIO = 1.5;
const SLOW_MIN_MS = 100;

export type Health = 'errors' | 'slow' | 'healthy';

export interface HomeService {
  name: string;
  namespace: string;
  version: string;
  health: Health;
  p95: string;
  errorRate: string;
  hasTraces: boolean;
  hasMetrics: boolean;
  // Span metrics exist but carry no service_namespace label.
  metricsWithoutNamespace: boolean;
  hasLogs: boolean;
  change: string;
  newVersion: boolean;
}

export interface HomeData {
  services: HomeService[];
  coverage: { traces: number; metrics: number; logs: number; total: number; withoutNamespace: number };
}

const finite = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value);
const nowSec = () => Math.floor(Date.now() / 1000);
const byName = (samples: InstantSample[]) => new Map(samples.map((s) => [s.metric.service_name, s.value]));
// The collector and sources with no service.name are not services a team sets up telemetry for.
const isAppService = (name: string) => !name.startsWith('otelcol') && !name.startsWith('unknown_service');

const p95 = (selector: string) =>
  `histogram_quantile(0.95, sum by (le, service_name) (rate(${BUCKET}{${selector}}[5m])))`;

// One row per service from the OTel resource attributes on the span metrics, with the signals each service reports.
export async function loadHome(): Promise<HomeData> {
  const end = nowSec();
  const start = end - WINDOW_S;
  const selector = `${SERVER},${NO_STREAMS}`;

  const [p95Now, p95Prev, errors, traffic, metricServices, newVersions, logServices, traceServices] = await Promise.all(
    [
      promInstant(p95(selector), end),
      promInstant(p95(selector), start),
      promInstant(
        `sum by (service_name) (rate(${CALLS}{${SERVER},${ERROR}}[5m])) / sum by (service_name) (rate(${CALLS}{${SERVER}}[5m]))`,
        end
      ),
      promInstant(`sum by (service_name, service_namespace, service_version) (rate(${CALLS}{${SERVER}}[5m]))`, end),
      promInstant(`count by (service_name) (rate(${CALLS}[5m]))`, end),
      promInstant(
        `count by (service_name, service_version) (rate(${CALLS}{${SERVER}}[5m])) unless count by (service_name, service_version) (rate(${CALLS}{${SERVER}}[5m] offset 30m))`,
        end
      ),
      lokiLabelValues('service_name', start, end),
      tempoTagValues('resource.service.name', start, end),
    ]
  );

  const nowMap = byName(p95Now);
  const prevMap = byName(p95Prev);
  const errorMap = byName(errors);
  const withMetrics = new Set(metricServices.map((s) => s.metric.service_name));
  const withLogs = new Set(logServices);
  const withTraces = new Set(traceServices);
  const started = new Map(newVersions.map((s) => [s.metric.service_name, s.metric.service_version]));

  // The busiest version series speaks for the service while two versions overlap.
  const busiest = new Map<string, { rate: number; version: string; namespace: string }>();
  for (const sample of traffic) {
    const name = sample.metric.service_name;
    if (finite(sample.value) && sample.value > (busiest.get(name)?.rate ?? -1)) {
      busiest.set(name, {
        rate: sample.value,
        version: sample.metric.service_version ?? '',
        namespace: sample.metric.service_namespace ?? '',
      });
    }
  }

  const names = [...new Set([...withMetrics, ...withLogs, ...withTraces])].filter(isAppService);
  const services: HomeService[] = names.map((name) => {
    const latency = nowMap.get(name);
    const before = prevMap.get(name);
    const rate = errorMap.get(name) ?? 0;
    const failing = rate >= ERROR_RATE_LIMIT;
    const slow =
      finite(latency) && finite(before) && before > 0 && latency / before >= SLOW_RATIO && latency >= SLOW_MIN_MS;
    const identity = busiest.get(name);
    const newVersion = started.has(name);
    let change = 'no change';
    if (failing) {
      change = `errors ${(rate * 100).toFixed(1)}%`;
    } else if (slow) {
      change = `p95 +${Math.round((latency / before - 1) * 100)}%`;
    } else if (newVersion) {
      change = `version ${started.get(name)} started`;
    }
    return {
      name,
      namespace: identity?.namespace ?? '',
      version: identity?.version ?? '',
      health: failing ? 'errors' : slow ? 'slow' : 'healthy',
      p95: finite(latency) ? formatMs(latency) : 'n/a',
      errorRate: `${(rate * 100).toFixed(1)}%`,
      hasTraces: withTraces.has(name),
      hasMetrics: withMetrics.has(name),
      metricsWithoutNamespace: withMetrics.has(name) && !identity?.namespace,
      hasLogs: withLogs.has(name),
      change,
      newVersion,
    };
  });

  // Services that changed come first, then the rest by name.
  const rank = (service: HomeService) =>
    service.health === 'errors' ? 0 : service.health === 'slow' ? 1 : service.newVersion ? 2 : 3;
  services.sort((a, b) => rank(a) - rank(b) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  return {
    services,
    coverage: {
      traces: services.filter((s) => s.hasTraces).length,
      metrics: services.filter((s) => s.hasMetrics).length,
      logs: services.filter((s) => s.hasLogs).length,
      total: services.length,
      withoutNamespace: services.filter((s) => s.metricsWithoutNamespace).length,
    },
  };
}
