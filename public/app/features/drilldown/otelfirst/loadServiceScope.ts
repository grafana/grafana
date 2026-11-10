import { lokiCount, lokiLogs, promInstant, tempoSearch } from '../realdata/labApi';
import { formatMs } from '../realdata/loadScenario';

const CALLS = 'traces_span_metrics_calls_total';
const BUCKET = 'traces_span_metrics_duration_milliseconds_bucket';
const SERVER = 'span_kind="SPAN_KIND_SERVER"';
const ERROR = 'status_code="STATUS_CODE_ERROR"';
// flagd keeps one streaming RPC open for minutes, which would top every latency ranking.
const NO_STREAMS = 'span_name!~".*EventStream.*"';
const WINDOW_S = 1800;
const LOG_LINES = 5;
const COMPARED_ATTRIBUTES = ['span_name', 'service_version'];
const MAX_COMPARED = 5;

export interface ServiceScope {
  name: string;
  namespace: string;
  version: string;
  metrics: { errorRate?: number; errorRatePrev?: number; p95?: number; p95Prev?: number };
  traces: { errorTraces: number; topErrorSpan?: { name: string; share: number } };
  logs: { perMinute?: number; perMinutePrev?: number; lines: Array<{ time: string; level: string; line: string }> };
  // Attribute values ranked by how far their share of errors differs from their share of all spans, in points.
  comparison: Array<{ attribute: string; value: string; points: number }>;
  queries: { metrics: string; traces: string; logs: string };
}

const nowSec = () => Math.floor(Date.now() / 1000);
const esc = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const finite = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value);

function shares(samples: Array<{ metric: Record<string, string>; value: number }>, label: string) {
  const totals = new Map<string, number>();
  let sum = 0;
  for (const sample of samples) {
    if (finite(sample.value)) {
      totals.set(sample.metric[label] ?? '', (totals.get(sample.metric[label] ?? '') ?? 0) + sample.value);
      sum += sample.value;
    }
  }
  return { totals, sum };
}

// Everything one service scope shows, read from the lab data sources with the same service identity.
export async function loadServiceScope(name: string, namespace: string, version: string): Promise<ServiceScope> {
  const end = nowSec();
  const start = end - WINDOW_S;
  const service = esc(name);
  const metricSelector = `service_name="${service}"`;
  const p95 = `histogram_quantile(0.95, sum by (le) (rate(${BUCKET}{${metricSelector},${SERVER},${NO_STREAMS}}[5m])))`;
  const errorRatio = `sum(rate(${CALLS}{${metricSelector},${SERVER},${ERROR}}[5m])) / sum(rate(${CALLS}{${metricSelector},${SERVER}}[5m]))`;
  const traceQuery = `{ resource.service.name="${service}" && status=error }`;
  const logSelector = `{service_name="${service}"}`;
  const logRate = `sum(count_over_time(${logSelector}[5m]))`;

  const compared = COMPARED_ATTRIBUTES.map((attribute) =>
    Promise.all([
      promInstant(`sum by (${attribute}) (rate(${CALLS}{${metricSelector},${ERROR}}[5m]))`, end),
      promInstant(`sum by (${attribute}) (rate(${CALLS}{${metricSelector}}[5m]))`, end),
    ])
  );

  const [errorNow, errorPrev, p95Now, p95Prev, errorTraces, logNow, logPrev, logLines, ...comparedRows] =
    await Promise.all([
      promInstant(errorRatio, end),
      promInstant(errorRatio, start),
      promInstant(p95, end),
      promInstant(p95, start),
      tempoSearch(traceQuery, start, end, 20),
      lokiCount(logRate, end).catch(() => undefined),
      lokiCount(logRate, start).catch(() => undefined),
      lokiLogs(logSelector, start, end, LOG_LINES).catch(() => []),
      ...compared,
    ]);

  const comparison: ServiceScope['comparison'] = [];
  let topErrorSpan: ServiceScope['traces']['topErrorSpan'];
  COMPARED_ATTRIBUTES.forEach((attribute, index) => {
    const [errorSamples, allSamples] = comparedRows[index];
    const errors = shares(errorSamples, attribute);
    const all = shares(allSamples, attribute);
    if (errors.sum <= 0 || all.sum <= 0) {
      return;
    }
    for (const [value, errorTotal] of errors.totals) {
      const errorShare = errorTotal / errors.sum;
      const points = (errorShare - (all.totals.get(value) ?? 0) / all.sum) * 100;
      comparison.push({ attribute, value, points });
      if (attribute === 'span_name' && errorShare > (topErrorSpan?.share ?? 0)) {
        topErrorSpan = { name: value, share: errorShare };
      }
    }
  });
  comparison.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));

  return {
    name,
    namespace,
    version,
    metrics: {
      errorRate: errorNow[0]?.value,
      errorRatePrev: errorPrev[0]?.value,
      p95: p95Now[0]?.value,
      p95Prev: p95Prev[0]?.value,
    },
    traces: { errorTraces: errorTraces.length, topErrorSpan },
    logs: {
      perMinute: logNow === undefined ? undefined : logNow / 5,
      perMinutePrev: logPrev === undefined ? undefined : logPrev / 5,
      lines: logLines.map((entry) => ({
        time: new Date(Number(entry.timeNs.slice(0, -6))).toLocaleTimeString([], { hour12: false }),
        level: entry.level,
        line: entry.line,
      })),
    },
    comparison: comparison.slice(0, MAX_COMPARED),
    queries: {
      metrics: `${namespace ? `job="${namespace}/${name}" · ` : ''}service_name="${name}"`,
      traces: traceQuery,
      logs: logSelector,
    },
  };
}

export function formatPercent(value: number | undefined): string {
  return finite(value) ? `${(value * 100).toFixed(1)}%` : 'no data';
}

export function formatLatency(value: number | undefined): string {
  return finite(value) ? formatMs(value) : 'no data';
}
