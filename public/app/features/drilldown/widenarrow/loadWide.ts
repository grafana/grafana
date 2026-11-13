import { t } from '@grafana/i18n';

import { type HomeService, loadHome } from '../otelfirst/loadHome';
import { type InstantSample, lokiInstant, promInstant, promRange } from '../realdata/labApi';
import { formatMs } from '../realdata/loadScenario';

const CALLS = 'traces_span_metrics_calls_total';
const BUCKET = 'traces_span_metrics_duration_milliseconds_bucket';
const SERVER = 'span_kind="SPAN_KIND_SERVER"';
const ERROR = 'status_code="STATUS_CODE_ERROR"';
// flagd keeps one streaming RPC open for minutes, which would top every latency ranking.
const NO_STREAMS = 'span_name!~".*EventStream.*"';
const WINDOW_S = 1800;
const HOUR_S = 3600;
const TREND_STEP_S = 120;
const ERROR_RATE_LIMIT = 0.01;
const LOG_RATIO = 2;
const LOG_MIN_LINES = 20;

// Services without service.namespace share one group so they stay visible at the team level.
export const NO_NAMESPACE = '(none)';

export type Impact = 'high' | 'low' | 'none';

export interface SignalChange {
  changed: boolean;
  text: string;
}

export interface WideService {
  home: HomeService;
  group: string;
  impact: Impact;
  metrics: SignalChange;
  traces: SignalChange;
  logs: SignalChange;
  profiles: SignalChange;
  // The changed signals joined into one line.
  summary: string;
  changedSignals: number;
  errorRate: number;
  slowRatio: number;
  trend: number[];
}

export interface VersionChange {
  service: string;
  version: string;
  group: string;
}

export interface WideData {
  services: WideService[];
  groups: string[];
  versionChanges: VersionChange[];
}

const finite = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value);
const nowSec = () => Math.floor(Date.now() / 1000);
const byName = (samples: InstantSample[]) => new Map(samples.map((s) => [s.metric.service_name, s.value]));
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const p95 = `histogram_quantile(0.95, sum by (le, service_name) (rate(${BUCKET}{${SERVER},${NO_STREAMS}}[5m])))`;
const errorRatio = `sum by (service_name) (rate(${CALLS}{${SERVER},${ERROR}}[5m])) / sum by (service_name) (rate(${CALLS}{${SERVER}}[5m]))`;
const logLines = 'sum by (service_name) (count_over_time({service_name=~".+"}[5m]))';

// Every service in the lab ranked by what changed in the last 30 minutes against the 30 minutes before, one
// reading per signal.
export async function loadWide(): Promise<WideData> {
  const end = nowSec();
  const start = end - WINDOW_S;
  const [home, p95Now, p95Prev, errNow, errPrev, logsNow, logsPrev, trends] = await Promise.all([
    loadHome(),
    promInstant(p95, end),
    promInstant(p95, start),
    promInstant(errorRatio, end),
    promInstant(errorRatio, start),
    lokiInstant(logLines, end).catch(() => []),
    lokiInstant(logLines, start).catch(() => []),
    promRange(p95, end - HOUR_S, end, TREND_STEP_S),
  ]);

  const latencyNow = byName(p95Now);
  const latencyPrev = byName(p95Prev);
  const errorNow = byName(errNow);
  const errorPrev = byName(errPrev);
  const linesNow = byName(logsNow);
  const linesPrev = byName(logsPrev);
  const trendOf = new Map(trends.map((series) => [series.metric.service_name, series.values.filter(finite)]));

  const services = home.services.map((service): WideService => {
    const name = service.name;
    const failing = service.health === 'errors';
    const slow = service.health === 'slow';
    const errors = errorNow.get(name) ?? 0;
    const errorsBefore = errorPrev.get(name);
    const latency = latencyNow.get(name);
    const latencyBefore = latencyPrev.get(name);
    const slowRatio = finite(latency) && finite(latencyBefore) && latencyBefore > 0 ? latency / latencyBefore : 1;
    const logs = linesNow.get(name);
    const logsBefore = linesPrev.get(name);
    const logsChanged =
      finite(logs) && finite(logsBefore) && logsBefore > 0 && logs >= LOG_MIN_LINES && logs / logsBefore >= LOG_RATIO;

    const metrics: SignalChange = {
      changed: failing && errors >= ERROR_RATE_LIMIT,
      text: !service.hasMetrics
        ? 'no span metrics'
        : failing
          ? `error rate ${finite(errorsBefore) ? percent(errorsBefore) : 'n/a'} to ${percent(errors)}`
          : 'no change',
    };
    const traces: SignalChange = {
      changed: slow,
      text: !service.hasTraces
        ? 'no spans'
        : slow
          ? `p95 ${formatMs(latencyBefore ?? 0)} to ${formatMs(latency ?? 0)}, +${Math.round((slowRatio - 1) * 100)}%`
          : 'no change',
    };
    const logChange: SignalChange = {
      changed: logsChanged,
      text: !service.hasLogs
        ? 'no logs'
        : logsChanged
          ? `volume +${Math.round(((logs ?? 0) / (logsBefore ?? 1) - 1) * 100)}%`
          : 'no change',
    };
    const profiles: SignalChange = { changed: false, text: t('drilldown-wide.signals.no-source', 'no source') };

    const changedSignals = [metrics, traces, logChange].filter((signal) => signal.changed).length;
    const parts = [
      metrics.changed ? metrics.text : undefined,
      traces.changed ? traces.text : undefined,
      logChange.changed ? `log ${logChange.text}` : undefined,
      service.newVersion ? `version ${service.version} started` : undefined,
    ].filter((part): part is string => part !== undefined);

    return {
      home: service,
      group: service.namespace || NO_NAMESPACE,
      impact: failing || slow ? 'high' : logsChanged || service.newVersion ? 'low' : 'none',
      metrics,
      traces,
      logs: logChange,
      profiles,
      summary: parts.join(' · '),
      changedSignals,
      errorRate: errors,
      slowRatio,
      trend: trendOf.get(name) ?? [],
    };
  });

  const rank = (service: WideService) => (service.impact === 'high' ? 0 : service.impact === 'low' ? 1 : 2);
  services.sort(
    (a, b) => rank(a) - rank(b) || b.changedSignals - a.changedSignals || compare(a.home.name, b.home.name)
  );

  const groups = [...new Set(services.map((service) => service.group))].sort((a, b) => {
    const sizeA = services.filter((service) => service.group === a).length;
    const sizeB = services.filter((service) => service.group === b).length;
    return sizeB - sizeA || compare(a, b);
  });

  return {
    services,
    groups,
    versionChanges: services
      .filter((service) => service.home.newVersion)
      .map((service) => ({ service: service.home.name, version: service.home.version, group: service.group })),
  };
}
