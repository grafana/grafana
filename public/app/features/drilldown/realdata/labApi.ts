import { dateTime } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

import { type Signal, requireDataSource } from '../dataSources';

type Params = Record<string, string | number>;

// Each call resolves the data source the user chose for its signal, so a change in the URL applies to the next query.
async function get<T>(signal: Signal, path: string, params?: Params): Promise<T> {
  const uid = await requireDataSource(signal);
  return getBackendSrv().get<T>(`/api/datasources/proxy/uid/${uid}/${path}`, params, undefined, {
    showErrorAlert: false,
  });
}

async function post<T>(signal: Signal, path: string, body: object): Promise<T> {
  const uid = await requireDataSource(signal);
  return getBackendSrv().post<T>(`/api/datasources/proxy/uid/${uid}/${path}`, body, { showErrorAlert: false });
}

interface PromResponse<R> {
  data: { result: R[] };
}

interface PromInstantRow {
  metric: Record<string, string>;
  value: [number, string];
}

interface PromRangeRow {
  metric: Record<string, string>;
  values: Array<[number, string]>;
}

export interface InstantSample {
  metric: Record<string, string>;
  value: number;
}

export interface RangeSeries {
  metric: Record<string, string>;
  times: number[];
  values: number[];
}

const toNumber = (raw: string) => Number(raw);

export async function promInstant(query: string, time: number): Promise<InstantSample[]> {
  const response = await get<PromResponse<PromInstantRow>>('metrics', 'api/v1/query', { query, time });
  return response.data.result.map((row) => ({ metric: row.metric, value: toNumber(row.value[1]) }));
}

const toRangeSeries = (row: PromRangeRow): RangeSeries => ({
  metric: row.metric,
  times: row.values.map(([time]) => time),
  values: row.values.map(([, v]) => toNumber(v)),
});

export async function promRange(query: string, start: number, end: number, step: number): Promise<RangeSeries[]> {
  const response = await get<PromResponse<PromRangeRow>>('metrics', 'api/v1/query_range', {
    query,
    start,
    end,
    step,
  });
  return response.data.result.map(toRangeSeries);
}

// A selector in match keeps only the values of the series it picks, which an unfiltered call on a large instance cuts short.
export async function promLabelValues(
  label: string,
  startSec: number,
  endSec: number,
  match?: string
): Promise<string[]> {
  const response = await get<{ data: string[] }>('metrics', `api/v1/label/${label}/values`, {
    start: startSec,
    end: endSec,
    ...(match ? { 'match[]': match } : {}),
  });
  return response.data;
}

// The label sets of up to limit series that the selector matches in the window.
export async function promSeries(
  match: string,
  startSec: number,
  endSec: number,
  limit: number
): Promise<Array<Record<string, string>>> {
  const response = await get<{ data: Array<Record<string, string>> }>('metrics', 'api/v1/series', {
    'match[]': match,
    start: startSec,
    end: endSec,
    limit,
  });
  return response.data;
}

interface LokiStream {
  stream: Record<string, string>;
  values: Array<[string, string]>;
}

interface LokiResponse<R> {
  data: { result: R[] };
}

export interface LogEntry {
  timeNs: string;
  level: string;
  line: string;
}

export async function lokiLogs(query: string, startSec: number, endSec: number, limit: number): Promise<LogEntry[]> {
  const response = await get<LokiResponse<LokiStream>>('logs', 'loki/api/v1/query_range', {
    query,
    start: startSec * 1e9,
    end: endSec * 1e9,
    limit,
    direction: 'backward',
  });
  return response.data.result.flatMap((stream) =>
    stream.values.map(([timeNs, line]) => ({ timeNs, level: stream.stream.detected_level ?? '', line }))
  );
}

export async function lokiCount(query: string, time: number): Promise<number> {
  const response = await get<LokiResponse<PromInstantRow>>('logs', 'loki/api/v1/query', { query, time });
  return response.data.result.reduce((sum, row) => sum + toNumber(row.value[1]), 0);
}

export async function lokiInstant(query: string, time: number): Promise<InstantSample[]> {
  const response = await get<LokiResponse<PromInstantRow>>('logs', 'loki/api/v1/query', { query, time });
  return response.data.result.map((row) => ({ metric: row.metric, value: toNumber(row.value[1]) }));
}

export async function lokiCountRange(query: string, start: number, end: number, step: number): Promise<number[]> {
  const response = await get<LokiResponse<PromRangeRow>>('logs', 'loki/api/v1/query_range', {
    query,
    start: start * 1e9,
    end: end * 1e9,
    step,
  });
  const first = response.data.result[0];
  return first ? first.values.map(([, v]) => toNumber(v)) : [];
}

// Keeps every series of a metric query with its labels, where lokiCountRange keeps the first series alone.
export async function lokiSeriesRange(query: string, start: number, end: number, step: number): Promise<RangeSeries[]> {
  const response = await get<LokiResponse<PromRangeRow>>('logs', 'loki/api/v1/query_range', {
    query,
    start: start * 1e9,
    end: end * 1e9,
    step,
  });
  return response.data.result.map(toRangeSeries);
}

export async function lokiLabelValues(label: string, startSec: number, endSec: number): Promise<string[]> {
  const response = await get<{ data: string[] }>('logs', `loki/api/v1/label/${label}/values`, {
    start: startSec * 1e9,
    end: endSec * 1e9,
  });
  return response.data;
}

export async function lokiLabelVolumes(startSec: number, endSec: number): Promise<InstantSample[]> {
  const response = await get<LokiResponse<PromInstantRow>>('logs', 'loki/api/v1/index/volume', {
    query: '{}',
    start: dateTime(startSec * 1000).toISOString(),
    end: dateTime(endSec * 1000).toISOString(),
    aggregateBy: 'labels',
    limit: 100,
  });
  return response.data.result.map((row) => ({ metric: row.metric, value: toNumber(row.value[1]) }));
}

export interface TempoSearchHit {
  traceID: string;
  rootServiceName?: string;
  rootTraceName?: string;
  durationMs?: number;
}

export async function tempoSearch(q: string, startSec: number, endSec: number, limit: number) {
  const response = await get<{ traces?: TempoSearchHit[] }>('traces', 'api/search', {
    q,
    start: startSec,
    end: endSec,
    limit,
  });
  return response.traces ?? [];
}

// A filter is a TraceQL selector, and only the values seen on spans that match it come back.
export async function tempoTagValues(
  tag: string,
  startSec: number,
  endSec: number,
  filter?: string
): Promise<string[]> {
  const response = await get<{ tagValues?: Array<{ value?: string }> }>('traces', `api/v2/search/tag/${tag}/values`, {
    start: startSec,
    end: endSec,
    ...(filter ? { q: filter } : {}),
  });
  // Tempo's JSON leaves the value out of an entry whose value is empty, and an empty name names nothing.
  return (response.tagValues ?? []).flatMap((entry) => (entry.value ? [entry.value] : []));
}

interface TempoMetricsLabel {
  key: string;
  value?: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean };
}

interface TempoMetricsSeries {
  labels?: TempoMetricsLabel[];
  samples?: Array<{ timestampMs?: string; value?: number }>;
}

const labelText = ({ value }: TempoMetricsLabel) =>
  String(value?.stringValue ?? value?.intValue ?? value?.doubleValue ?? value?.boolValue ?? '');

// Tempo's JSON sends an int64 as a string and leaves out a zero, so a sample with no value counts as 0.
export async function tempoMetricsRange(
  query: string,
  startSec: number,
  endSec: number,
  stepSec: number
): Promise<RangeSeries[]> {
  const response = await get<{ series?: TempoMetricsSeries[] }>('traces', 'api/metrics/query_range', {
    q: query,
    start: startSec,
    end: endSec,
    step: `${stepSec}s`,
  });
  return (response.series ?? []).map((series) => ({
    metric: Object.fromEntries((series.labels ?? []).map((label) => [label.key, labelText(label)])),
    times: (series.samples ?? []).map((sample) => Number(sample.timestampMs) / 1000),
    values: (series.samples ?? []).map((sample) => sample.value ?? 0),
  }));
}

interface PyroscopeSeries {
  labels?: Array<{ name: string; value: string }>;
  points?: Array<{ value?: number; timestamp?: string }>;
}

// Pyroscope names a profile type name:type:unit:period type:period unit.
export const CPU_PROFILE_TYPE = 'process_cpu:cpu:nanoseconds:cpu:nanoseconds';

export async function pyroscopeSelectSeries(
  labelSelector: string,
  startSec: number,
  endSec: number,
  stepSec: number
): Promise<RangeSeries[]> {
  const response = await post<{ series?: PyroscopeSeries[] }>('profiles', 'querier.v1.QuerierService/SelectSeries', {
    profileTypeID: CPU_PROFILE_TYPE,
    labelSelector,
    start: startSec * 1000,
    end: endSec * 1000,
    step: stepSec,
    groupBy: [],
  });
  return (response.series ?? []).map((series) => ({
    metric: Object.fromEntries((series.labels ?? []).map((label) => [label.name, label.value])),
    times: (series.points ?? []).map((point) => Number(point.timestamp) / 1000),
    values: (series.points ?? []).map((point) => point.value ?? 0),
  }));
}

export async function pyroscopeLabelValues(name: string, startSec: number, endSec: number): Promise<string[]> {
  const response = await post<{ names?: string[] }>('profiles', 'querier.v1.QuerierService/LabelValues', {
    name,
    start: startSec * 1000,
    end: endSec * 1000,
  });
  return response.names ?? [];
}

interface OtlpAttribute {
  key: string;
  value: { stringValue?: string };
}

export interface OtlpSpan {
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  // Tempo returns the status as an object, with the code as a number or as its enum name. Spans with no status send {}.
  status?: { code?: number | string };
}

export interface OtlpBatch {
  resource: { attributes: OtlpAttribute[] };
  scopeSpans: Array<{ spans: OtlpSpan[] }>;
}

export async function tempoTrace(traceId: string): Promise<OtlpBatch[]> {
  const response = await get<{ batches?: OtlpBatch[] }>('traces', `api/traces/${traceId}`);
  return response.batches ?? [];
}
