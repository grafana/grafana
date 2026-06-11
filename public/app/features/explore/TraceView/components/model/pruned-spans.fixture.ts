// Shared test fixtures for pruned span summaries (Tier 1).
//
// Shape: TraceResponse (the input to transformTraceData()), matching the existing
// TraceView test pattern. Deterministic (handcrafted) rather than Chance.js-generated,
// so assertions on extracted aggregation values are stable.
//
// These are module-level singletons and transformTraceData() mutates its input in place.
// Callers MUST clone (e.g. structuredClone) before transforming, or reuse across tests
// will share mutated state. Clone the raw fixture, never a transformed trace: post-transform
// spans hold circular `ref.span` references that break structuredClone.
//
// IMPORTANT unit split:
//   - span.startTime / span.duration are MICROSECONDS (Grafana trace model; see types/trace.ts).
//   - aggregation.duration_*_ns tag values are NANOSECONDS (raw processor attribute values).
//   - aggregation.histogram_bucket_bounds_s tag values are SECONDS (float).
// So a summary span's model duration (the wall-clock group window) is intentionally
// LARGER than duration_max_ns / 1000 - that is the timing-semantics case later tiers must surface.
//
// Tag value typing matches the processor source (createSummarySpanWithParent in aggregation.go):
// bools via PutBool (real JS booleans, never "true"), ints via PutInt, strings via PutStr,
// arrays via PutEmptySlice. Verified against a real ops summary span captured 2026-06-08.

import { type TraceKeyValuePair } from '@grafana/data';

import { type TraceResponse, type TraceSpanData, type TraceProcess } from '../types/trace';

const PROC_LOKI: TraceProcess = {
  serviceName: 'loki-query-engine',
  serviceNamespace: 'loki',
  tags: [
    { key: 'cluster', value: 'ops', type: 'string' },
    { key: 'k8s.pod.name', value: 'loki-query-engine-7c9d8f5b6-x4k2p', type: 'string' },
  ],
};
const PROCESSES: Record<string, TraceProcess> = { p1: PROC_LOKI };

// Histogram bounds (seconds) shared across fixtures; processor default-style buckets.
const BOUNDS_S = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

// Template (slowest-span) attributes the summary span inherits.
const DB_TEMPLATE_TAGS: TraceKeyValuePair[] = [
  { key: 'db.system', value: 'postgresql', type: 'string' },
  { key: 'db.namespace', value: 'loki_index', type: 'string' },
  { key: 'db.operation.name', value: 'SELECT', type: 'string' },
  { key: 'server.address', value: 'db-0.loki-ops.svc', type: 'string' },
];

function defaultAggTags(o: {
  count: number;
  minNs: number;
  maxNs: number;
  avgNs: number;
  totalNs: number;
  counts: number[]; // cumulative, length === BOUNDS_S.length + 1 (trailing +Inf bucket), last === count
}): TraceKeyValuePair[] {
  return [
    { key: 'aggregation.is_summary', value: true, type: 'bool' },
    { key: 'aggregation.span_count', value: o.count, type: 'int64' },
    { key: 'aggregation.duration_min_ns', value: o.minNs, type: 'int64' },
    { key: 'aggregation.duration_max_ns', value: o.maxNs, type: 'int64' },
    { key: 'aggregation.duration_avg_ns', value: o.avgNs, type: 'int64' },
    { key: 'aggregation.duration_total_ns', value: o.totalNs, type: 'int64' },
    // Histogram attrs are config-gated in the processor and NOT emitted by ops today (verified
    // 2026-06-08 against the raw Tempo trace-by-id API). Kept here for the OTLP/manual path and
    // forward-compat; do NOT assume these reach transformTraceData. See summaryAsObservedInOps
    // for a fixture matching what ops/the UI actually produce.
    { key: 'aggregation.histogram_bucket_bounds_s', value: BOUNDS_S, type: 'float64[]' },
    { key: 'aggregation.histogram_bucket_counts', value: o.counts, type: 'int64[]' },
  ];
}

const childOf = (traceID: string, parentSpanID: string) => [
  { refType: 'CHILD_OF' as const, traceID, spanID: parentSpanID },
];

function rootSpan(traceID: string, spanID: string, startUs: number, durationUs: number): TraceSpanData {
  return {
    traceID,
    spanID,
    processID: 'p1',
    flags: 0,
    operationName: 'HTTP GET /loki/api/v1/query_range',
    kind: 'server',
    statusCode: 0,
    references: [],
    startTime: startUs,
    duration: durationUs,
    tags: [
      { key: 'http.request.method', value: 'GET', type: 'string' },
      { key: 'url.path', value: '/loki/api/v1/query_range', type: 'string' },
      { key: 'http.response.status_code', value: 200, type: 'int64' },
    ],
    logs: [],
  };
}

function summarySpan(
  traceID: string,
  spanID: string,
  parentSpanID: string,
  startUs: number,
  durationUs: number,
  aggTags: TraceKeyValuePair[]
): TraceSpanData {
  return {
    traceID,
    spanID,
    processID: 'p1',
    flags: 0,
    operationName: 'SELECT',
    kind: 'client',
    statusCode: 0,
    references: childOf(traceID, parentSpanID),
    startTime: startUs,
    duration: durationUs,
    tags: [...DB_TEMPLATE_TAGS, ...aggTags],
    logs: [],
  };
}

// A preserved outlier is a SIBLING of the summary span (same parentSpanID), not a child,
// linked back via aggregation.summary_span_id.
function preservedOutlierSpan(
  traceID: string,
  spanID: string,
  parentSpanID: string,
  summarySpanID: string,
  startUs: number,
  durationUs: number
): TraceSpanData {
  return {
    traceID,
    spanID,
    processID: 'p1',
    flags: 0,
    operationName: 'SELECT',
    kind: 'client',
    statusCode: 0,
    references: childOf(traceID, parentSpanID),
    startTime: startUs,
    duration: durationUs,
    tags: [
      ...DB_TEMPLATE_TAGS,
      { key: 'aggregation.is_preserved_outlier', value: true, type: 'bool' },
      { key: 'aggregation.summary_span_id', value: summarySpanID, type: 'string' },
    ],
    logs: [],
  };
}

function plainSpan(
  traceID: string,
  spanID: string,
  parentSpanID: string,
  operationName: string,
  startUs: number,
  durationUs: number
): TraceSpanData {
  return {
    traceID,
    spanID,
    processID: 'p1',
    flags: 0,
    operationName,
    kind: 'client',
    statusCode: 0,
    references: childOf(traceID, parentSpanID),
    startTime: startUs,
    duration: durationUs,
    tags: [{ key: 'component', value: 'loki', type: 'string' }],
    logs: [],
  };
}

const T = 1780628654000000; // base start time in microseconds

// ---------------------------------------------------------------------------
// Case 1: Summary span with all DEFAULT attributes only.
// 8 spans grouped; durations 4/6/8/9/12/18/22/60 ms; window 80ms (> max 60ms).
// ---------------------------------------------------------------------------
export const summaryDefaultsOnly: TraceResponse = {
  traceID: 'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1',
  processes: PROCESSES,
  spans: [
    rootSpan('a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1', 'root00000000a101', T, 1_650_000),
    summarySpan(
      'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1',
      'summ00000000a101',
      'root00000000a101',
      T + 10_000,
      80_000, // 80ms window in µs
      defaultAggTags({
        count: 8,
        minNs: 4_000_000,
        maxNs: 60_000_000,
        avgNs: 17_375_000,
        totalNs: 139_000_000,
        counts: [1, 4, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8],
      })
    ),
  ],
};

// ---------------------------------------------------------------------------
// Case 2: Summary span WITH conditional attributes (median, outlier correlations,
// attribute-loss analysis) but NO preserved outliers.
// ---------------------------------------------------------------------------
export const summaryWithConditionalAttrs: TraceResponse = {
  traceID: 'b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2',
  processes: PROCESSES,
  spans: [
    rootSpan('b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2', 'root00000000b201', T, 1_650_000),
    summarySpan('b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2', 'summ00000000b201', 'root00000000b201', T + 10_000, 80_000, [
      ...defaultAggTags({
        count: 8,
        minNs: 4_000_000,
        maxNs: 60_000_000,
        avgNs: 17_375_000,
        totalNs: 139_000_000,
        counts: [1, 4, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8],
      }),
      { key: 'aggregation.duration_median_ns', value: 9_000_000, type: 'int64' },
      {
        key: 'aggregation.outlier_correlated_attributes',
        value: 'db.namespace=loki_index(80%/12%), server.address=db-7.loki-ops.svc(60%/5%)',
        type: 'string',
      },
      // diverse_attributes format verified from real ops data (2026-06-08): `attr_name(distinct_count)`,
      // comma-separated for multiple, e.g. real sample was "messaging.kafka.destination.partition(4)".
      { key: 'aggregation.diverse_attributes', value: 'db.namespace(3), net.peer.name(7)', type: 'string' },
      // missing_attributes format still unconfirmed (not present in the sampled trace); modeled to match.
      { key: 'aggregation.missing_attributes', value: 'user.id(2)', type: 'string' },
    ]),
  ],
};

// ---------------------------------------------------------------------------
// Case 3: Summary span WITHOUT optional attributes (outlier analysis off).
// Small group (count 2) to vary from case 1; asserts detection works on bare defaults
// and that median/outlier/preserved tags are absent.
// ---------------------------------------------------------------------------
export const summaryNoOptionalAttrs: TraceResponse = {
  traceID: 'c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3',
  processes: PROCESSES,
  spans: [
    rootSpan('c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3', 'root00000000c301', T, 900_000),
    summarySpan(
      'c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3',
      'summ00000000c301',
      'root00000000c301',
      T + 5_000,
      30_000, // 30ms window
      defaultAggTags({
        count: 2,
        minNs: 8_000_000,
        maxNs: 21_000_000,
        avgNs: 14_500_000,
        totalNs: 29_000_000,
        counts: [0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2],
      })
    ),
  ],
};

// ---------------------------------------------------------------------------
// Case 4: Preserved-outlier scenario. Summary carries preserved_outlier_count/ids;
// two outlier spans are SIBLINGS of the summary (same parent = root), each linking
// back via aggregation.summary_span_id.
// ---------------------------------------------------------------------------
export const summaryWithPreservedOutliers: TraceResponse = {
  traceID: 'd4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4',
  processes: PROCESSES,
  spans: [
    rootSpan('d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4', 'root00000000d401', T, 1_650_000),
    summarySpan('d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4', 'summ00000000d401', 'root00000000d401', T + 10_000, 80_000, [
      ...defaultAggTags({
        count: 8,
        minNs: 4_000_000,
        maxNs: 75_000_000,
        avgNs: 21_000_000,
        totalNs: 168_000_000,
        counts: [1, 3, 6, 6, 7, 8, 8, 8, 8, 8, 8, 8],
      }),
      { key: 'aggregation.preserved_outlier_count', value: 2, type: 'int64' },
      {
        key: 'aggregation.preserved_outlier_span_ids',
        value: ['outl00000000d401', 'outl00000000d402'],
        type: 'string[]',
      },
    ]),
    preservedOutlierSpan(
      'd4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4',
      'outl00000000d401',
      'root00000000d401',
      'summ00000000d401',
      T + 12_000,
      60_000 // 60ms real outlier
    ),
    preservedOutlierSpan(
      'd4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4',
      'outl00000000d402',
      'root00000000d401',
      'summ00000000d401',
      T + 20_000,
      75_000 // 75ms real outlier
    ),
  ],
};

// ---------------------------------------------------------------------------
// Case 5: Mixed trace - normal spans + a summary span + a preserved outlier sibling.
// Asserts normal spans are left unaffected while summary/outlier are detected.
// ---------------------------------------------------------------------------
export const mixedTrace: TraceResponse = {
  traceID: 'e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5',
  processes: PROCESSES,
  spans: [
    rootSpan('e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5', 'root00000000e501', T, 1_650_000),
    plainSpan(
      'e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5',
      'norm00000000e501',
      'root00000000e501',
      'auth.check',
      T + 2_000,
      3_000
    ),
    plainSpan(
      'e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5',
      'norm00000000e502',
      'root00000000e501',
      'cache.get',
      T + 6_000,
      1_500
    ),
    summarySpan('e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5', 'summ00000000e501', 'root00000000e501', T + 10_000, 80_000, [
      ...defaultAggTags({
        count: 5,
        minNs: 5_000_000,
        maxNs: 60_000_000,
        avgNs: 22_000_000,
        totalNs: 110_000_000,
        counts: [0, 1, 2, 3, 4, 5, 5, 5, 5, 5, 5, 5],
      }),
      { key: 'aggregation.preserved_outlier_count', value: 1, type: 'int64' },
      { key: 'aggregation.preserved_outlier_span_ids', value: ['outl00000000e501'], type: 'string[]' },
    ]),
    preservedOutlierSpan(
      'e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5',
      'outl00000000e501',
      'root00000000e501',
      'summ00000000e501',
      T + 15_000,
      60_000
    ),
  ],
};

// ---------------------------------------------------------------------------
// Case 6: REAL-DATA-DERIVED. Mirrors an actual ops summary span captured 2026-06-08
// (service sampler-gateway, a Kafka "publish" PRODUCER span, span_count 5).
// Differs from the synthetic cases in ways that match observed reality:
//   - NO histogram attributes (config-gated in the processor; not emitted by ops).
//   - duration_median_ns present (outlier analysis is enabled in ops).
//   - diverse_attributes present in the real `attr_name(count)` format.
//   - int values are plain numbers; is_summary is a real boolean.
// Use this as the "what the UI actually receives today" baseline.
// ---------------------------------------------------------------------------
const PROC_SAMPLER: TraceProcess = {
  serviceName: 'sampler-gateway',
  serviceNamespace: 'faro',
  tags: [
    { key: 'cluster', value: 'ops-eu-south-0', type: 'string' },
    { key: 'k8s.namespace.name', value: 'faro', type: 'string' },
  ],
};
const TR = 1780935937000000; // µs

export const summaryAsObservedInOps: TraceResponse = {
  traceID: '970f938eb2cc7b680d6a2d089d5a5119',
  processes: { p2: PROC_SAMPLER },
  spans: [
    {
      traceID: '970f938eb2cc7b680d6a2d089d5a5119',
      spanID: '7c89712911e16a5d',
      processID: 'p2',
      flags: 0,
      operationName: 'HTTP POST - collect',
      kind: 'server',
      statusCode: 0,
      references: [],
      startTime: TR,
      duration: 1_000_000,
      tags: [{ key: 'http.request.method', value: 'POST', type: 'string' }],
      logs: [],
    },
    {
      traceID: '970f938eb2cc7b680d6a2d089d5a5119',
      spanID: 'a1aggsamplerpub1',
      processID: 'p2',
      flags: 0,
      operationName: 'sampler-ingest publish',
      kind: 'producer',
      statusCode: 0,
      references: childOf('970f938eb2cc7b680d6a2d089d5a5119', '7c89712911e16a5d'),
      startTime: TR + 590_830, // µs
      duration: 215_629, // µs window (~215.6ms); note this exceeds duration_max_ns / 1000
      tags: [
        // inherited (slowest-span) template attributes
        { key: 'messaging.system', value: 'kafka', type: 'string' },
        { key: 'messaging.operation', value: 'publish', type: 'string' },
        { key: 'messaging.destination.name', value: 'sampler-ingest', type: 'string' },
        { key: 'messaging.kafka.destination.partition', value: 155, type: 'int64' },
        { key: 'tailsampling.cached_decision', value: true, type: 'bool' },
        // aggregation.* exactly as observed (NO histogram arrays)
        { key: 'aggregation.is_summary', value: true, type: 'bool' },
        { key: 'aggregation.span_count', value: 5, type: 'int64' },
        { key: 'aggregation.duration_min_ns', value: 164304113, type: 'int64' },
        { key: 'aggregation.duration_max_ns', value: 215615080, type: 'int64' },
        { key: 'aggregation.duration_total_ns', value: 975143860, type: 'int64' },
        { key: 'aggregation.duration_avg_ns', value: 195028772, type: 'int64' },
        { key: 'aggregation.duration_median_ns', value: 215118016, type: 'int64' },
        { key: 'aggregation.diverse_attributes', value: 'messaging.kafka.destination.partition(4)', type: 'string' },
      ],
      logs: [],
    },
  ],
};
