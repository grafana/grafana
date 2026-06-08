// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { type TraceKeyValuePair, type TraceLog } from '@grafana/data';

/**
 * All timestamps are in microseconds
 */

export type TraceLink = {
  url: string;
  text: string;
};

export type TraceProcess = {
  serviceName: string;
  serviceNamespace?: string;
  tags: TraceKeyValuePair[];
};

export type TraceSpanReference = {
  refType: 'CHILD_OF' | 'FOLLOWS_FROM' | 'EXTERNAL';
  // eslint-disable-next-line no-use-before-define
  span?: TraceSpan | null | undefined;
  spanID: string;
  traceID: string;
  tags?: TraceKeyValuePair[];
};

export type TraceSpanData = {
  spanID: string;
  traceID: string;
  processID: string;
  operationName: string;
  // Times are in microseconds
  startTime: number;
  duration: number;
  logs: TraceLog[];
  tags?: TraceKeyValuePair[];
  kind?: string;
  statusCode?: number;
  statusMessage?: string;
  instrumentationLibraryName?: string;
  instrumentationLibraryVersion?: string;
  traceState?: string;
  references?: TraceSpanReference[];
  warnings?: string[] | null;
  stackTraces?: string[];
  flags: number;
  errorIconColor?: string;
  dataFrameRowIndex?: number;
  childSpanIds?: string[];
};

/**
 * Aggregation metadata extracted from a pruned span's `aggregation.*` tags.
 *
 * The span pruning processor replaces a group of similar spans with a single
 * "summary span" carrying these attributes, and reparents any preserved
 * outliers as siblings of the summary span. See the spanpruningprocessor:
 * https://github.com/grafana/opentelemetry-collector-extras/tree/main/processor/spanpruningprocessor
 *
 * Present only on spans that carry at least one `aggregation.*` tag; normal
 * spans leave `TraceSpan.aggregation` undefined.
 *
 * Durations are kept in raw nanoseconds (the processor's `duration_*_ns`
 * units) rather than converted to the microseconds used by `startTime` /
 * `duration`, so display formatting stays lossless and source-faithful.
 */
export type SpanAggregation = {
  // True on summary spans (`aggregation.is_summary`).
  isSummary: boolean;
  // True on preserved outlier spans (`aggregation.is_preserved_outlier`).
  isPreservedOutlier: boolean;
  // Number of spans collapsed into this summary (`aggregation.span_count`).
  spanCount?: number;
  // Min/max/avg duration across the group, in nanoseconds. Always emitted on summary spans.
  durationMinNs?: number;
  durationMaxNs?: number;
  durationAvgNs?: number;
  // Median duration, in nanoseconds. Conditional: only set when outlier analysis is enabled.
  durationMedianNs?: number;
  // On a preserved outlier span, the spanID of the summary span it was preserved from
  // (`aggregation.summary_span_id`).
  summarySpanId?: string;
  // TODO: Tier 2 stats display may also surface `duration_total_ns` and the histogram
  // attributes (`histogram_bucket_bounds_s` / `histogram_bucket_counts`). They are left
  // unextracted here because Tier 1 has no use for them, and histograms are config-gated
  // in the processor (not emitted by ops today). (grafana/grafana-adaptivetraces-app#1018)
};

export type TraceSpan = TraceSpanData & {
  depth: number;
  hasChildren: boolean;
  childSpanCount: number;
  process: TraceProcess;
  relativeStartTime: number;
  tags: NonNullable<TraceSpanData['tags']>;
  references: NonNullable<TraceSpanData['references']>;
  warnings: NonNullable<TraceSpanData['warnings']>;
  childSpanIds: NonNullable<TraceSpanData['childSpanIds']>;
  subsidiarilyReferencedBy: TraceSpanReference[];
  // Aggregation metadata for pruned (summary / preserved-outlier) spans; undefined for normal spans.
  aggregation?: SpanAggregation;
};

export type TraceData = {
  processes: Record<string, TraceProcess>;
  traceID: string;
  warnings?: string[] | null;
};

export type TraceResponse = TraceData & {
  spans: TraceSpanData[];
};

export type Trace = TraceData & {
  duration: number;
  endTime: number;
  spans: TraceSpan[];
  startTime: number;
  traceName: string;
  services: Array<{ name: string; numberOfSpans: number }>;
};

// It is a section of span that lies on critical path
export type CriticalPathSection = {
  spanId: string;
  section_start: number;
  section_end: number;
};

// Type for the plugin link context that includes trace data and datasource information
export type TraceViewPluginExtensionContext = Trace & {
  datasource: {
    name: string;
    uid: string;
    type: string;
  };
};
