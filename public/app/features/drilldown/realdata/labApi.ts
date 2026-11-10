import { getBackendSrv } from '@grafana/runtime';

// The three OTel lab data sources, created in this Grafana with these UIDs.
export const METRICS_UID = 'otel-lab-metrics';
export const LOGS_UID = 'otel-lab-logs';
export const TRACES_UID = 'otel-lab-traces';

type Params = Record<string, string | number>;

function get<T>(uid: string, path: string, params?: Params): Promise<T> {
  return getBackendSrv().get<T>(`/api/datasources/proxy/uid/${uid}/${path}`, params, undefined, {
    showErrorAlert: false,
  });
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
  const response = await get<PromResponse<PromInstantRow>>(METRICS_UID, 'api/v1/query', { query, time });
  return response.data.result.map((row) => ({ metric: row.metric, value: toNumber(row.value[1]) }));
}

export async function promRange(query: string, start: number, end: number, step: number): Promise<RangeSeries[]> {
  const response = await get<PromResponse<PromRangeRow>>(METRICS_UID, 'api/v1/query_range', {
    query,
    start,
    end,
    step,
  });
  return response.data.result.map((row) => ({
    metric: row.metric,
    times: row.values.map(([time]) => time),
    values: row.values.map(([, v]) => toNumber(v)),
  }));
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
  const response = await get<LokiResponse<LokiStream>>(LOGS_UID, 'loki/api/v1/query_range', {
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
  const response = await get<LokiResponse<PromInstantRow>>(LOGS_UID, 'loki/api/v1/query', { query, time });
  return response.data.result.reduce((sum, row) => sum + toNumber(row.value[1]), 0);
}

export async function lokiCountRange(query: string, start: number, end: number, step: number): Promise<number[]> {
  const response = await get<LokiResponse<PromRangeRow>>(LOGS_UID, 'loki/api/v1/query_range', {
    query,
    start: start * 1e9,
    end: end * 1e9,
    step,
  });
  const first = response.data.result[0];
  return first ? first.values.map(([, v]) => toNumber(v)) : [];
}

export async function lokiLabelValues(label: string, startSec: number, endSec: number): Promise<string[]> {
  const response = await get<{ data: string[] }>(LOGS_UID, `loki/api/v1/label/${label}/values`, {
    start: startSec * 1e9,
    end: endSec * 1e9,
  });
  return response.data;
}

export interface TempoSearchHit {
  traceID: string;
  rootServiceName?: string;
  rootTraceName?: string;
  durationMs?: number;
}

export async function tempoSearch(q: string, startSec: number, endSec: number, limit: number) {
  const response = await get<{ traces?: TempoSearchHit[] }>(TRACES_UID, 'api/search', {
    q,
    start: startSec,
    end: endSec,
    limit,
  });
  return response.traces ?? [];
}

export async function tempoTagValues(tag: string, startSec: number, endSec: number): Promise<string[]> {
  const response = await get<{ tagValues?: Array<{ value: string }> }>(TRACES_UID, `api/v2/search/tag/${tag}/values`, {
    start: startSec,
    end: endSec,
  });
  return (response.tagValues ?? []).map((entry) => entry.value);
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
  const response = await get<{ batches?: OtlpBatch[] }>(TRACES_UID, `api/traces/${traceId}`);
  return response.batches ?? [];
}

export interface DatasourceJson {
  jsonData?: {
    tracesToLogsV2?: { datasourceUid?: string };
    tracesToLogs?: { datasourceUid?: string };
  };
}

// The data source settings, which hold the trace to logs mapping.
export function datasourceJson(uid: string): Promise<DatasourceJson> {
  return getBackendSrv().get<DatasourceJson>(`/api/datasources/uid/${uid}`, undefined, undefined, {
    showErrorAlert: false,
  });
}

export interface StreamLog {
  timeNs: string;
  level: string;
  service: string;
  line: string;
}

// Like lokiLogs, and keeps the service each line came from, so lines from many services can share one list.
export async function lokiStreamLogs(
  query: string,
  startSec: number,
  endSec: number,
  limit: number
): Promise<StreamLog[]> {
  const response = await get<LokiResponse<LokiStream>>(LOGS_UID, 'loki/api/v1/query_range', {
    query,
    start: startSec * 1e9,
    end: endSec * 1e9,
    limit,
    direction: 'backward',
  });
  return response.data.result.flatMap((stream) =>
    stream.values.map(([timeNs, line]) => ({
      timeNs,
      level: stream.stream.detected_level ?? '',
      service: stream.stream.service_name ?? '',
      line,
    }))
  );
}
