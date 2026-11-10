import { t } from '@grafana/i18n';

import {
  type InstantSample,
  type LogEntry,
  type OtlpBatch,
  type RangeSeries,
  type TempoSearchHit,
  lokiCount,
  lokiCountRange,
  lokiLabelValues,
  lokiLogs,
  promInstant,
  promRange,
  tempoSearch,
  tempoTagValues,
  tempoTrace,
} from './labApi';
import {
  type AppKey,
  type Hint,
  type InsightSummary,
  type LogLevel,
  type Overview,
  type Scope,
  type ScopeData,
  type ServiceSummary,
  type SignalCoverage,
  type SpanColor,
  type TraceSpan,
  type TraceView,
} from './liveScenario';

const CALLS = 'traces_span_metrics_calls_total';
const BUCKET = 'traces_span_metrics_duration_milliseconds_bucket';
const SERVER = 'span_kind="SPAN_KIND_SERVER"';
const ERROR = 'status_code="STATUS_CODE_ERROR"';
// flagd keeps one streaming RPC open for minutes, which would top every latency ranking.
const NO_STREAMS = 'span_name!~".*EventStream.*"';
const OVERVIEW_WINDOW_S = 1800;
const ERROR_RATE_LIMIT = 0.01;
const SLOW_RATIO = 1.5;
const SLOW_MIN_MS = 100;
const MAX_SERVICES = 8;
const MAX_HINTS = 4;
const SPAN_PALETTE: SpanColor[] = ['blue', 'orange', 'green', 'purple'];

const nowSec = () => Math.floor(Date.now() / 1000);
const esc = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const finite = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value);

export function formatMs(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.round(ms)}ms`;
}

function percentChange(now: number | undefined, before: number | undefined): string {
  if (!finite(now) || !finite(before) || before <= 0) {
    return 'no earlier data to compare';
  }
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}% vs the previous window`;
}

// Scales a series so 1 is its average, which is how the sparklines draw "normal".
function relative(values: number[]): number[] {
  const usable = values.filter(finite);
  if (usable.length < 2) {
    return [1, 1];
  }
  const mean = usable.reduce((sum, v) => sum + v, 0) / usable.length || 1;
  return values.map((v) => (finite(v) ? v / mean : 1));
}

const p95 = (selector: string, by = '', window = '5m') =>
  `histogram_quantile(0.95, sum by (le${by}) (rate(${BUCKET}{${selector}}[${window}])))`;
const errorRatio = (selector: string, window = '5m') =>
  `sum(rate(${CALLS}{${selector},${ERROR}}[${window}])) / sum(rate(${CALLS}{${selector}}[${window}]))`;

function bySeries(samples: InstantSample[], label = 'service_name') {
  return new Map(samples.map((s) => [s.metric[label], s.value]));
}

function clockTime(timeNs: string) {
  const date = new Date(Number(timeNs.slice(0, -6)));
  return date.toLocaleTimeString([], { hour12: false });
}

function toLevel(raw: string): LogLevel {
  const level = raw.toLowerCase();
  if (['error', 'err', 'fatal', 'critical'].includes(level)) {
    return 'error';
  }
  if (['warn', 'warning'].includes(level)) {
    return 'warn';
  }
  return 'info';
}

export async function loadOverview(): Promise<Overview> {
  const end = nowSec();
  const start = end - OVERVIEW_WINDOW_S;
  const byService = ', service_name';

  const [
    p95Now,
    p95Prev,
    errors,
    traffic,
    p95Range,
    allSpanMetrics,
    namespaces,
    newVersions,
    logServices,
    traceServices,
  ] = await Promise.all([
    promInstant(p95(SERVER, byService), end),
    promInstant(p95(SERVER, byService), start),
    promInstant(
      `sum by (service_name) (rate(${CALLS}{${SERVER},${ERROR}}[5m])) / sum by (service_name) (rate(${CALLS}{${SERVER}}[5m]))`,
      end
    ),
    promInstant(`sum by (service_name, service_namespace, service_version) (rate(${CALLS}{${SERVER}}[5m]))`, end),
    promRange(p95(SERVER, byService), start, end, 90),
    promInstant(`count by (service_name) (rate(${CALLS}[5m]))`, end),
    promInstant(`count by (service_namespace) (${CALLS})`, end),
    promInstant(
      `count by (service_name, service_version) (rate(${CALLS}{${SERVER}}[5m])) unless count by (service_name, service_version) (rate(${CALLS}{${SERVER}}[5m] offset 30m))`,
      end
    ),
    lokiLabelValues('service_name', start, end),
    tempoTagValues('resource.service.name', start, end),
  ]);

  const nowMap = bySeries(p95Now);
  const prevMap = bySeries(p95Prev);
  const errorMap = bySeries(errors);
  const rangeMap = new Map<string, RangeSeries>(p95Range.map((series) => [series.metric.service_name, series]));

  // One row per service: the version series with the most traffic wins when two versions overlap.
  const busiest = new Map<string, { rate: number; version: string }>();
  for (const sample of traffic) {
    const name = sample.metric.service_name;
    if (finite(sample.value) && sample.value > (busiest.get(name)?.rate ?? -1)) {
      busiest.set(name, { rate: sample.value, version: sample.metric.service_version ?? '' });
    }
  }
  const ranked = [...busiest.entries()].sort((a, b) => b[1].rate - a[1].rate).map(([name]) => name);

  const isSlow = (name: string) => {
    const now = nowMap.get(name);
    const before = prevMap.get(name);
    return finite(now) && finite(before) && before > 0 && now / before >= SLOW_RATIO && now >= SLOW_MIN_MS;
  };
  const isFailing = (name: string) => (errorMap.get(name) ?? 0) >= ERROR_RATE_LIMIT;
  const trendOf = (name: string) => relative(rangeMap.get(name)?.values ?? []);

  const services: ServiceSummary[] = ranked.slice(0, MAX_SERVICES).map((name) => {
    const degraded = isSlow(name) || isFailing(name);
    const latency = nowMap.get(name);
    const version = busiest.get(name)?.version;
    return {
      name,
      health: degraded ? 'degraded' : 'healthy',
      p95: finite(latency) ? formatMs(latency) : 'n/a',
      errorRate: `${((errorMap.get(name) ?? 0) * 100).toFixed(1)}%`,
      trend: trendOf(name),
      lastDeploy: version ? `v${version}` : 'unknown',
    };
  });

  const hints: Hint[] = [];
  for (const name of ranked) {
    const latency = nowMap.get(name);
    const before = prevMap.get(name);
    const rate = errorMap.get(name) ?? 0;
    if (isFailing(name)) {
      hints.push({
        id: `errors-${name}`,
        severity: 'errors',
        title: `${name} returns errors on ${(rate * 100).toFixed(1)}% of requests`,
        description: `${finite(latency) ? `p95 latency ${formatMs(latency)}` : 'p95 latency n/a'} · server spans, last 5 minutes`,
        scope: { type: 'service', value: name },
        investigable: true,
        trendLabel: `${name} p95 latency`,
        trend: trendOf(name),
      });
    } else if (isSlow(name) && finite(latency) && finite(before)) {
      hints.push({
        id: `slow-${name}`,
        severity: 'slow',
        title: `${name} is slower than the previous 30 minutes`,
        description: `p95 latency ${formatMs(latency)}, up ${Math.round((latency / before - 1) * 100)}% from ${formatMs(before)}`,
        scope: { type: 'service', value: name },
        investigable: true,
        trendLabel: `${name} p95 latency`,
        trend: trendOf(name),
      });
    }
  }
  const flagged = new Set(hints.map((hint) => hint.scope.value));
  for (const sample of newVersions) {
    const name = sample.metric.service_name;
    if (!flagged.has(name)) {
      hints.push({
        id: `deploy-${name}`,
        severity: 'deploy',
        title: `${name} version ${sample.metric.service_version} started reporting`,
        description: t('drilldown-real.data.no-change', 'No change in latency or errors so far'),
        scope: { type: 'service', value: name },
        investigable: false,
        trendLabel: 'p95 latency',
        trend: trendOf(name),
      });
    }
  }

  const metricNames = allSpanMetrics.map((s) => s.metric.service_name);
  // The collector and sources with no service.name are not services a team sets up telemetry for.
  const isAppService = (name: string) => !name.startsWith('otelcol') && !name.startsWith('unknown_service');
  const universe = [...new Set([...metricNames, ...logServices, ...traceServices])].filter(isAppService).sort();
  const missingOf = (present: string[]) => {
    const absent = universe.filter((name) => !present.includes(name));
    return absent.length > 2 ? [...absent.slice(0, 2), `${absent.length - 2} more`] : absent;
  };
  const coverage = (app: AppKey, question: string, present: string[]): SignalCoverage => ({
    app,
    question,
    covered: universe.filter((name) => present.includes(name)).length,
    total: universe.length,
    unit: 'services',
    missing: missingOf(present),
  });
  const signals: SignalCoverage[] = [
    coverage('metrics', 'What changed, without PromQL', metricNames),
    coverage('logs', 'Patterns and errors, without LogQL', logServices),
    coverage('traces', 'Where requests slow down', traceServices),
    {
      app: 'profiles',
      question: 'Which code uses CPU and memory',
      covered: 0,
      total: universe.length,
      unit: 'services',
      missing: [],
      noSource: true,
    },
    {
      app: 'sql',
      question: 'Business impact in your data',
      covered: 0,
      total: 0,
      unit: 'databases',
      missing: [],
      noSource: true,
    },
  ];

  const allTrends = [...services.map((s) => s.trend), ...hints.map((h) => h.trend)].flat();
  const trendMax = Math.min(6, Math.max(2, ...allTrends.filter(finite).map((v) => v * 1.1)));

  return {
    hints: hints.slice(0, MAX_HINTS),
    scopeValues: {
      service: ranked,
      environment: [],
      namespace: namespaces.map((s) => s.metric.service_namespace).filter(Boolean),
    },
    trendMax,
    services,
    signals,
    exampleService: hints[0]?.scope.value ?? ranked[0] ?? 'a service',
  };
}

function selectors(scope: Scope) {
  const value = esc(scope.value);
  switch (scope.type) {
    case 'service':
      return {
        prom: `service_name="${value}"`,
        loki: `service_name="${value}"`,
        tempo: `resource.service.name="${value}"`,
      };
    case 'namespace':
      return {
        prom: `service_namespace="${value}"`,
        loki: `service_namespace="${value}"`,
        tempo: `resource.service.namespace="${value}"`,
      };
    case 'environment':
      return {
        prom: `deployment_environment_name="${value}"`,
        loki: `deployment_environment_name="${value}"`,
        tempo: `resource.deployment.environment.name="${value}"`,
      };
  }
}

export async function loadScope(scope: Scope, fromSec: number, toSec: number): Promise<ScopeData> {
  const duration = Math.max(60, toSec - fromSec);
  const window = `${Math.max(120, Math.round(duration / 6))}s`;
  const sel = selectors(scope);
  const server = `${SERVER},${sel.prom}`;
  const routeBy = ', span_name';
  const spanSel = `${sel.prom},${NO_STREAMS}`;
  const sparkStep = Math.max(15, Math.round(duration / 20));
  const durationStep = Math.max(15, Math.round(duration / 35));
  const errorLogs = `{${sel.loki}, detected_level="error"}`;

  const [
    p95Now,
    p95Prev,
    errorNow,
    namespace,
    series,
    topRoute,
    topSpan,
    errorsNow,
    errorsPrev,
    errorSeries,
    logs,
    hits,
  ] = await Promise.all([
    promInstant(p95(server, '', window), toSec),
    promInstant(p95(server, '', window), fromSec),
    promInstant(errorRatio(server, window), toSec),
    promInstant(`count by (service_namespace) (rate(${CALLS}{${sel.prom}}[${window}]))`, toSec),
    promRange(p95(server, '', window), fromSec, toSec, sparkStep),
    promInstant(`topk(1, ${p95(`${server},${NO_STREAMS}`, routeBy, window)})`, toSec),
    promInstant(`topk(1, ${p95(spanSel, routeBy, window)})`, toSec),
    lokiCount(`sum(count_over_time(${errorLogs}[${duration}s]))`, toSec),
    lokiCount(`sum(count_over_time(${errorLogs}[${duration}s]))`, fromSec),
    lokiCountRange(`sum(count_over_time(${errorLogs}[${sparkStep}s]))`, fromSec, toSec, sparkStep),
    lokiLogs(`{${sel.loki}}`, fromSec, toSec, 60),
    tempoSearch(`{ ${sel.tempo} }`, fromSec, toSec, 20),
  ]);

  const latency = p95Now[0]?.value;
  const latencyBefore = p95Prev[0]?.value;
  const errorShare = errorNow[0]?.value ?? 0;
  const route = topRoute[0]?.metric.span_name ?? '';
  const slowestSpan = topSpan[0]?.metric.span_name ?? '';

  const [routeSeries, routeBefore, spanBefore, spanSeries, versionSeries] = await Promise.all([
    route ? promRange(p95(`${server},span_name="${esc(route)}"`, '', window), fromSec, toSec, durationStep) : [],
    route ? promInstant(p95(`${server},span_name="${esc(route)}"`, '', window), fromSec) : [],
    slowestSpan ? promInstant(p95(`${sel.prom},span_name="${esc(slowestSpan)}"`, '', window), fromSec) : [],
    slowestSpan
      ? promRange(p95(`${sel.prom},span_name="${esc(slowestSpan)}"`, '', window), fromSec, toSec, sparkStep)
      : [],
    promRange(`count by (service_version) (rate(${CALLS}{${sel.prom}}[${window}]))`, fromSec, toSec, durationStep),
  ]);

  const requestDuration = (routeSeries[0]?.values ?? []).map((v) => (finite(v) ? v / 1000 : 0));
  const routeNow = routeSeries[0]?.values.filter(finite).at(-1);

  // A version that first reports inside the range is the closest thing to a deploy marker the lab has.
  const firstSeen = versionSeries
    .filter((s) => s.metric.service_version && s.times.length > 0)
    .map((s) => ({ version: s.metric.service_version, first: s.times[0] }));
  const newest = firstSeen.sort((a, b) => b.first - a.first)[0];
  const deploy =
    firstSeen.length > 1 && newest && newest.first > fromSec + durationStep
      ? {
          index: Math.min(requestDuration.length - 1, Math.round((newest.first - fromSec) / durationStep)),
          version: newest.version,
        }
      : { index: -1, version: '' };

  const trace = await buildTrace(hits);
  const logLines = pickLogLines(logs);
  const minutes = Math.round(duration / 60);

  const spanValue = topSpan[0]?.value;
  const insights: InsightSummary[] = [
    {
      app: 'metrics',
      label: t('drilldown-real.data.p95-latency', 'p95 latency'),
      value: finite(latency) ? formatMs(latency) : 'n/a',
      change: percentChange(latency, latencyBefore),
      trend: relative(series[0]?.values ?? []),
    },
    {
      app: 'logs',
      label: t('drilldown-real.data.error-logs', 'Error logs'),
      value: String(errorsNow),
      change: `${errorsPrev} in the previous ${minutes} minutes`,
      trend: relative(errorSeries),
      tone: errorsNow > errorsPrev ? 'bad' : 'neutral',
    },
    {
      app: 'traces',
      label: t('drilldown-real.data.slowest-span', 'Slowest span'),
      value: slowestSpan || t('drilldown-real.data.no-spans', 'no spans'),
      change: finite(spanValue)
        ? `p95 ${formatMs(spanValue)}, ${percentChange(spanValue, spanBefore[0]?.value)}`
        : 'no spans in this range',
      trend: relative(spanSeries[0]?.values ?? []),
    },
    {
      app: 'profiles',
      label: t('drilldown-real.data.top-function', 'Top function'),
      value: t('drilldown-real.data.no-source', 'No data source'),
      change: t('drilldown-real.data.connect-pyroscope', 'Connect a Pyroscope data source to see CPU and memory'),
      trend: [],
      tone: 'neutral',
    },
    {
      app: 'sql',
      label: t('drilldown-real.data.failed-orders', 'Failed orders'),
      value: t('drilldown-real.data.no-source', 'No data source'),
      change: t('drilldown-real.data.connect-sql', 'Connect a SQL data source to see business impact'),
      trend: [],
      tone: 'neutral',
    },
  ];

  const detectionSteps: Array<{ app: AppKey; finding: string }> = [
    {
      app: 'metrics',
      finding: `p95 latency ${finite(latency) ? formatMs(latency) : 'n/a'}, ${percentChange(latency, latencyBefore)}`,
    },
    { app: 'logs', finding: `${errorsNow} error logs in the last ${minutes} minutes` },
    { app: 'traces', finding: slowestSpan ? `${slowestSpan} is the slowest span` : 'No spans in this range' },
    { app: 'profiles', finding: 'No profiles data source connected' },
    { app: 'sql', finding: 'No SQL data source connected' },
  ];

  const errorText =
    errorShare >= ERROR_RATE_LIMIT ? `Server spans fail on ${(errorShare * 100).toFixed(1)}% of requests. ` : '';
  const slowText =
    finite(latency) && finite(latencyBefore) && latencyBefore > 0
      ? `p95 latency is ${formatMs(latency)}, ${percentChange(latency, latencyBefore)}. `
      : '';
  const likelyCause =
    `${errorText}${slowText}${slowestSpan ? `The slowest span is ${slowestSpan}.` : ''}`.trim() ||
    'No change found in this range.';

  return {
    detectionSteps,
    detectedScope: {
      namespace: namespace.find((s) => s.metric.service_namespace)?.metric.service_namespace ?? '',
      since: `last ${minutes} minutes`,
      likelyCause,
    },
    insights,
    deployIndex: deploy.index,
    deployLabel: deploy.version ? `version ${deploy.version}` : '',
    requestDuration,
    requestRoute: route,
    requestStepMs: durationStep * 1000,
    logLines,
    trace,
    evidenceText: {
      impact: route
        ? `Slowest route ${route}: p95 ${finite(routeNow) ? formatMs(routeNow) : 'n/a'}, ${percentChange(routeNow, routeBefore[0]?.value)}.`
        : 'No server spans in this range.',
      requestCaption: deploy.version
        ? `Dashed line: version ${deploy.version} first seen · route ${route}`
        : `p95 latency of ${route || 'the slowest route'} over the range. No version change in this range.`,
      where: trace.spans.length > 0 ? `Slowest recent request: ${trace.summary}` : 'No trace found in this range.',
      why: 'No profiles or SQL data source is connected, so this group has no data.',
    },
  };
}

function pickLogLines(entries: LogEntry[]) {
  return entries
    .sort((a, b) => (a.timeNs < b.timeNs ? 1 : -1))
    .slice(0, 9)
    .map((entry) => ({
      time: clockTime(entry.timeNs),
      level: toLevel(entry.level),
      message: entry.line.slice(0, 140),
    }));
}

const emptyTrace: TraceView = { name: '', durationMs: 0, axisTicks: [], summary: '', spans: [], slowThresholdMs: 0 };

async function buildTrace(hits: TempoSearchHit[]): Promise<TraceView> {
  // Traces over a minute are long-lived streams, not requests.
  const candidates = hits
    .filter((hit) => (hit.durationMs ?? 0) < 60_000)
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0));
  const best = candidates[0];
  if (!best) {
    return emptyTrace;
  }
  return toTraceView(await tempoTrace(best.traceID), best);
}

interface FlatSpan {
  id: string;
  parent: string;
  service: string;
  name: string;
  startUs: number;
  endUs: number;
}

function toTraceView(batches: OtlpBatch[], hit: TempoSearchHit): TraceView {
  const spans: FlatSpan[] = batches.flatMap((batch) => {
    const service = batch.resource.attributes.find((a) => a.key === 'service.name')?.value.stringValue ?? 'unknown';
    return batch.scopeSpans.flatMap((scope) =>
      scope.spans.map((span) => ({
        id: span.spanId,
        parent: span.parentSpanId ?? '',
        service,
        name: span.name,
        startUs: Number(span.startTimeUnixNano.slice(0, -3)),
        endUs: Number(span.endTimeUnixNano.slice(0, -3)),
      }))
    );
  });
  if (spans.length === 0) {
    return emptyTrace;
  }

  const byId = new Map(spans.map((span) => [span.id, span]));
  const depthOf = (span: FlatSpan): number => {
    let depth = 0;
    let cursor = byId.get(span.parent);
    while (cursor && depth < 12) {
      depth += 1;
      cursor = byId.get(cursor.parent);
    }
    return depth;
  };

  const traceStart = Math.min(...spans.map((s) => s.startUs));
  const traceEnd = Math.max(...spans.map((s) => s.endUs));
  const totalMs = (traceEnd - traceStart) / 1000;
  const root = spans.find((s) => !byId.has(s.parent)) ?? spans[0];

  // Keep the root and the longest spans so the waterfall stays readable, in start order.
  const kept = [...spans]
    .sort((a, b) => b.endUs - b.startUs - (a.endUs - a.startUs))
    .slice(0, 14)
    .sort((a, b) => a.startUs - b.startUs || depthOf(a) - depthOf(b));
  if (!kept.includes(root)) {
    kept.unshift(root);
  }

  const colors = new Map<string, SpanColor>();
  const view: TraceSpan[] = kept.map((span) => {
    if (!colors.has(span.service)) {
      colors.set(span.service, SPAN_PALETTE[colors.size % SPAN_PALETTE.length]);
    }
    return {
      service: span.service,
      operation: span.name,
      depth: depthOf(span),
      startMs: Math.round((span.startUs - traceStart) / 1000),
      durationMs: Math.max(1, Math.round((span.endUs - span.startUs) / 1000)),
      color: colors.get(span.service) ?? 'blue',
    };
  });

  // Wrapper spans that cover almost the whole request say nothing about where the time goes.
  const longestChild = view
    .filter((span) => span.depth > 0 && span.durationMs < totalMs * 0.9)
    .sort((a, b) => b.durationMs - a.durationMs)[0];
  const share = longestChild ? Math.round((longestChild.durationMs / totalMs) * 100) : 0;
  const rootName = hit.rootTraceName ?? root.name;

  return {
    name: rootName,
    durationMs: Math.round(totalMs),
    axisTicks: [0, 1, 2, 3].map((i) => (i === 0 ? '0' : formatMs((totalMs * i) / 3))),
    summary: longestChild
      ? `${rootName} took ${formatMs(totalMs)}. ${longestChild.service} ${longestChild.operation} accounts for ${share}% of it.`
      : `${rootName} took ${formatMs(totalMs)}.`,
    spans: view,
    slowThresholdMs: totalMs * 0.25,
  };
}
