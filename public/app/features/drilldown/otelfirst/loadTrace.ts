import { lokiStreamLogs, tempoSearch, tempoTrace } from '../realdata/labApi';

const SEARCH_WINDOW_S = 1800;
const TRACE_PADDING_S = 60;
const RESOURCE_WINDOW_S = 1800;
const LOG_LIMIT = 60;
const ERROR_CODES = new Set(['2', 'STATUS_CODE_ERROR']);

export type LogScope = 'trace' | 'resource' | 'resource-trace' | 'span';

export interface TraceSpanRow {
  spanId: string;
  service: string;
  name: string;
  // Milliseconds from the start of the trace.
  offsetMs: number;
  durationMs: number;
  error: boolean;
}

export interface TraceData {
  traceId: string;
  durationMs: number;
  startSec: number;
  endSec: number;
  spans: TraceSpanRow[];
  services: string[];
}

export interface TraceLog {
  timeNs: string;
  level: string;
  service: string;
  line: string;
}

const nowSec = () => Math.floor(Date.now() / 1000);
const esc = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
// Nanosecond strings are too long for a number. Microseconds fit, so cut three digits and divide.
const micros = (nano: string) => Number(nano.slice(0, -3));

// Tempo sends span IDs as base64 in OTLP JSON. Loki stores them as hex.
function toHex(spanId: string): string {
  if (/^[0-9a-f]{16}$/i.test(spanId)) {
    return spanId.toLowerCase();
  }
  try {
    return [...atob(spanId)].map((char) => char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  } catch {
    return spanId;
  }
}

// Tempo search drops leading zeros from trace IDs. Loki and OTLP use all 32 hex digits.
const toTraceId = (traceId: string) => traceId.padStart(32, '0');

// The newest trace with an error span for the service, or its newest trace when none has errors.
export async function findTrace(service: string): Promise<{ traceId: string; failing: boolean } | undefined> {
  const end = nowSec();
  const start = end - SEARCH_WINDOW_S;
  const name = esc(service);
  const failing = await tempoSearch(`{ resource.service.name="${name}" && status=error }`, start, end, 1);
  if (failing[0]) {
    return { traceId: toTraceId(failing[0].traceID), failing: true };
  }
  const any = await tempoSearch(`{ resource.service.name="${name}" }`, start, end, 1);
  return any[0] ? { traceId: toTraceId(any[0].traceID), failing: false } : undefined;
}

export async function loadTrace(traceId: string): Promise<TraceData> {
  const batches = await tempoTrace(traceId);
  const rows: Array<TraceSpanRow & { startUs: number; endUs: number }> = [];
  for (const batch of batches) {
    const service =
      batch.resource.attributes.find((attribute) => attribute.key === 'service.name')?.value.stringValue ?? '';
    for (const scope of batch.scopeSpans) {
      for (const span of scope.spans) {
        const startUs = micros(span.startTimeUnixNano);
        const endUs = micros(span.endTimeUnixNano);
        rows.push({
          spanId: toHex(span.spanId),
          service,
          name: span.name,
          offsetMs: 0,
          durationMs: (endUs - startUs) / 1000,
          error: ERROR_CODES.has(String(span.status?.code)),
          startUs,
          endUs,
        });
      }
    }
  }
  const startUs = Math.min(...rows.map((row) => row.startUs));
  const endUs = Math.max(...rows.map((row) => row.endUs));
  const spans = rows
    .map((row) => ({
      spanId: row.spanId,
      service: row.service,
      name: row.name,
      offsetMs: (row.startUs - startUs) / 1000,
      durationMs: row.durationMs,
      error: row.error,
    }))
    // Errored spans first, then the order they started in.
    .sort((a, b) => Number(b.error) - Number(a.error) || a.offsetMs - b.offsetMs);
  return {
    traceId,
    durationMs: (endUs - startUs) / 1000,
    startSec: startUs / 1e6,
    endSec: endUs / 1e6,
    spans,
    services: [...new Set(spans.map((span) => span.service))].sort(),
  };
}

// The log lines for one trace, in the scope the user picked.
export async function loadTraceLogs(trace: TraceData, scope: LogScope, span?: TraceSpanRow): Promise<TraceLog[]> {
  const byTrace = () =>
    lokiStreamLogs(
      `{service_name=~".+"} | trace_id="${esc(trace.traceId)}"`,
      Math.floor(trace.startSec) - TRACE_PADDING_S,
      Math.ceil(trace.endSec) + TRACE_PADDING_S,
      LOG_LIMIT
    );
  const byResource = () => {
    const at = trace.startSec + (span?.offsetMs ?? 0) / 1000;
    return lokiStreamLogs(
      `{service_name="${esc(span?.service ?? trace.services[0] ?? '')}"}`,
      Math.floor(at) - RESOURCE_WINDOW_S,
      Math.ceil(at) + RESOURCE_WINDOW_S,
      LOG_LIMIT
    );
  };
  const bySpan = () =>
    lokiStreamLogs(
      `{service_name=~".+"} | span_id="${esc(span?.spanId ?? '')}"`,
      Math.floor(trace.startSec) - TRACE_PADDING_S,
      Math.ceil(trace.endSec) + TRACE_PADDING_S,
      LOG_LIMIT
    );

  const lists = await Promise.all(
    scope === 'trace'
      ? [byTrace()]
      : scope === 'resource'
        ? [byResource()]
        : scope === 'span'
          ? [bySpan()]
          : [byTrace(), byResource()]
  );
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((log) => {
      const key = `${log.timeNs}${log.service}${log.line}`;
      return seen.has(key) ? false : (seen.add(key), true);
    })
    .sort((a, b) => (a.timeNs < b.timeNs ? -1 : a.timeNs > b.timeNs ? 1 : 0));
}
