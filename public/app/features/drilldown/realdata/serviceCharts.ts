import { type Signal, getSelectedDataSource } from '../dataSources';

import {
  type RangeSeries,
  lokiLogs,
  lokiSeriesRange,
  promRange,
  promSeries,
  pyroscopeSelectSeries,
  tempoMetricsRange,
  tempoTagValues,
} from './labApi';
import { LOG_SERVICE_NAMES, PROFILE_SERVICE_NAMES, SPAN_METRICS } from './liveScenario';
import { OVERVIEW_WINDOW_S, describeError, esc, p95 } from './loadScenario';
import { resolveValue } from './resolveValue';
import { SERVER_OR_CONSUMER } from './spanMetrics';

// One point per minute, so a count in a step reads as a count per minute.
const STEP_S = 60;

const NANOSECONDS_PER_SECOND = 1e9;

export type ChartKind = 'traces' | 'metrics' | 'logs' | 'profiles';

export interface ChartSeries {
  name: string;
  // Milliseconds, the unit of the chart's time field.
  times: number[];
  values: number[];
}

// What the lookups after an empty chart found. Each one limits what the chart can say about the service.
export type EmptyReason =
  // The service has spans, and none of them are server or consumer spans.
  | { type: 'no-server-spans'; kinds: string[] }
  | { type: 'no-spans' }
  // The span metrics hold no series for the service. The flags say where else the service shows up.
  | { type: 'no-series'; metric: string; label: string; otherMetrics: boolean; inJob: boolean }
  // Series or lines exist for the service, and the chart's filters keep none of them.
  | { type: 'filtered' }
  | { type: 'no-lines' }
  // The data source lists no value that stands for the service.
  | { type: 'no-value' }
  | { type: 'outside-environment' };

// A chart's own query tells whether the service exists in its data source. An answer with no data is empty, and the
// reason says what a lookup after it found. The value is what the chart's selector matched in the data source.
export type ChartState =
  | { kind: 'data'; series: ChartSeries[]; value?: string }
  | { kind: 'empty'; reason?: EmptyReason; value?: string }
  | { kind: 'no-source' }
  | { kind: 'error'; message: string };

export type ServiceCharts = Record<ChartKind, ChartState>;

// A span with no status set did not fail, and the chart counts it with the spans that say they did not.
const STATUS_NAMES: Record<string, string> = { unset: 'ok' };

const kindName = (value: string) => value.replace(/^SPAN_KIND_/i, '').toLowerCase();

const regexEscape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function toSeries(rows: RangeSeries[], label: string | undefined, fallback: string): ChartSeries[] {
  return rows.map((row) => ({
    name: (label && row.metric[label]) || fallback,
    times: row.times.map((time) => time * 1000),
    values: row.values,
  }));
}

// Series that share a name add up, point by point.
function mergeStatuses(series: ChartSeries[]): ChartSeries[] {
  const merged = new Map<string, Map<number, number>>();
  for (const one of series) {
    const name = STATUS_NAMES[one.name] ?? one.name;
    const points = merged.get(name) ?? new Map<number, number>();
    one.times.forEach((time, index) => points.set(time, (points.get(time) ?? 0) + one.values[index]));
    merged.set(name, points);
  }
  return [...merged].map(([name, points]) => {
    const times = [...points.keys()].sort((a, b) => a - b);
    return { name, times, values: times.map((time) => points.get(time) ?? 0) };
  });
}

const hasData = (series: ChartSeries[]) => series.some((one) => one.values.some(Number.isFinite));

async function run(signal: Signal, query: () => Promise<ChartState>): Promise<ChartState> {
  try {
    if (!(await getSelectedDataSource(signal))) {
      return { kind: 'no-source' };
    }
    return await query();
  } catch (error) {
    return { kind: 'error', message: describeError(error) };
  }
}

// A lookup that fails leaves the empty chart with the sentence its own query supports.
async function reasonFrom(lookup: () => Promise<EmptyReason | undefined>): Promise<EmptyReason | undefined> {
  try {
    return await lookup();
  } catch {
    return undefined;
  }
}

const once = <T>(load: () => Promise<T>) => {
  let loaded: Promise<T> | undefined;
  return () => (loaded ??= load());
};

// Each chart answers on its own, so one data source that fails leaves the other charts working.
export async function loadServiceCharts(service: string, environment?: string): Promise<ServiceCharts> {
  const toSec = Math.floor(Date.now() / 1000);
  const fromSec = toSec - OVERVIEW_WINDOW_S;
  const spanMetrics = SPAN_METRICS;
  const name = esc(service);
  const env = environment ? esc(environment) : undefined;

  // The matchers that pick the service in each data source, narrowed to the environment when there is one. Logs and
  // profiles name the service with the value their data source holds, which is not always the Tempo name.
  const tempo = env
    ? `resource.service.name="${name}" && resource.deployment.environment.name="${env}"`
    : `resource.service.name="${name}"`;
  const prom = env
    ? `${spanMetrics.service}="${name}",deployment_environment_name="${env}"`
    : `${spanMetrics.service}="${name}"`;
  const loki = (value: string) =>
    env ? `service_name="${esc(value)}",deployment_environment_name="${env}"` : `service_name="${esc(value)}"`;
  const pyroscope = (value: string) =>
    env ? `service_name="${esc(value)}",cluster="${env}"` : `service_name="${esc(value)}"`;

  const namespaces = once(() =>
    tempoTagValues('resource.k8s.namespace.name', fromSec, toSec, `{ resource.service.name="${name}" }`)
  );

  const spanKinds = () =>
    reasonFrom(async (): Promise<EmptyReason | undefined> => {
      const found = await tempoMetricsRange(
        `{ resource.service.name="${name}" } | count_over_time() by (kind)`,
        fromSec,
        toSec,
        STEP_S
      );
      const kinds = [
        ...new Set(
          found.filter((one) => one.values.some((value) => value > 0)).map((one) => kindName(one.metric.kind ?? ''))
        ),
      ]
        .filter(Boolean)
        .sort();
      if (kinds.includes('server') || kinds.includes('consumer')) {
        return undefined;
      }
      return kinds.length > 0 ? { type: 'no-server-spans', kinds } : { type: 'no-spans' };
    });

  const metricsReason = () =>
    reasonFrom(async (): Promise<EmptyReason> => {
      const calls = await promSeries(`${spanMetrics.calls}{${spanMetrics.service}="${name}"}`, fromSec, toSec, 1);
      if (calls.length > 0) {
        return { type: 'filtered' };
      }
      const [otherMetrics, inJob] = await Promise.all([
        promSeries(`{${spanMetrics.service}="${name}"}`, fromSec, toSec, 1),
        promSeries(`{job=~"(.+/)?${esc(regexEscape(service))}"}`, fromSec, toSec, 1),
      ]);
      return {
        type: 'no-series',
        metric: spanMetrics.calls,
        label: spanMetrics.service,
        otherMetrics: otherMetrics.length > 0,
        inJob: inJob.length > 0,
      };
    });

  const tracesChart = () =>
    run('traces', async () => {
      const series = mergeStatuses(
        toSeries(
          await tempoMetricsRange(
            `{ ${tempo} && (kind = server || kind = consumer) } | count_over_time() by (status)`,
            fromSec,
            toSec,
            STEP_S
          ),
          'status',
          'spans'
        )
      );
      return hasData(series) ? { kind: 'data', series } : { kind: 'empty', reason: await spanKinds() };
    });

  const p95Chart = () =>
    run('metrics', async () => {
      const series = toSeries(
        await promRange(p95(`${SERVER_OR_CONSUMER},${prom}`, '', '5m', spanMetrics), fromSec, toSec, STEP_S),
        undefined,
        'p95'
      );
      return hasData(series) ? { kind: 'data', series } : { kind: 'empty', reason: await metricsReason() };
    });

  const hasLines = async (matchers: string) => (await lokiLogs(`{${matchers}}`, fromSec, toSec, 1)).length > 0;

  const logsChart = () =>
    run('logs', async () => {
      // An empty list says nothing, because the call that fills it can fail, so the Tempo name is tried as it is.
      const value = LOG_SERVICE_NAMES.length > 0 ? await resolveValue(service, LOG_SERVICE_NAMES, namespaces) : service;
      if (value === undefined) {
        return { kind: 'empty', reason: { type: 'no-value' } };
      }
      const series = toSeries(
        await lokiSeriesRange(
          `sum(count_over_time({${loki(value)}} | detected_level="error" [${STEP_S}s]))`,
          fromSec,
          toSec,
          STEP_S
        ),
        undefined,
        'errors'
      );
      if (hasData(series)) {
        return { kind: 'data', series, value };
      }
      // A count of lines with an error level returns no series when there are none, so a service that has lines
      // and no errors still has a count of zero.
      try {
        if (await hasLines(loki(value))) {
          const times = Array.from(
            { length: OVERVIEW_WINDOW_S / STEP_S + 1 },
            (_, step) => (fromSec + step * STEP_S) * 1000
          );
          return { kind: 'data', series: [{ name: 'errors', times, values: times.map(() => 0) }], value };
        }
        const elsewhere = env ? await hasLines(`service_name="${esc(value)}"`) : false;
        return { kind: 'empty', reason: elsewhere ? { type: 'filtered' } : { type: 'no-lines' }, value };
      } catch {
        return { kind: 'empty', value };
      }
    });

  // Pyroscope sums the CPU time of the profiles in a step, in nanoseconds, so a step of N seconds holds N times the
  // cores that ran.
  const toCores = (series: ChartSeries[]) =>
    series.map((one) => ({
      ...one,
      values: one.values.map((value) => value / (STEP_S * NANOSECONDS_PER_SECOND)),
    }));

  const profilesChart = () =>
    run('profiles', async () => {
      const value = await resolveValue(service, await PROFILE_SERVICE_NAMES(), namespaces);
      if (value === undefined) {
        return { kind: 'empty', reason: { type: 'no-value' } };
      }
      const series = toCores(
        toSeries(await pyroscopeSelectSeries(`{${pyroscope(value)}}`, fromSec, toSec, STEP_S), undefined, 'cpu')
      );
      if (hasData(series)) {
        return { kind: 'data', series, value };
      }
      // With an environment chosen, the same query without it tells a service with no profiles from one with none there.
      const reason = env
        ? await reasonFrom(async (): Promise<EmptyReason | undefined> => {
            const anywhere = toSeries(
              await pyroscopeSelectSeries(`{service_name="${esc(value)}"}`, fromSec, toSec, STEP_S),
              undefined,
              'cpu'
            );
            return hasData(anywhere) ? { type: 'outside-environment' } : undefined;
          })
        : undefined;
      return { kind: 'empty', reason, value };
    });

  const [traces, metrics, logs, profiles] = await Promise.all([
    tracesChart(),
    p95Chart(),
    logsChart(),
    profilesChart(),
  ]);

  return { traces, metrics, logs, profiles };
}
