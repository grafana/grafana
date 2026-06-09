// Copyright (c) 2019 The Jaeger Authors.
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

import { type TraceKeyValuePair } from '@grafana/data';

import { type Trace, type TraceResponse } from '../types/trace';

import {
  mixedTrace,
  summaryAsObservedInOps,
  summaryDefaultsOnly,
  summaryNoOptionalAttrs,
  summaryWithConditionalAttrs,
  summaryWithPreservedOutliers,
} from './pruned-spans.fixture';
import transformTraceData, { orderTags, deduplicateTags } from './transform-trace-data';

function spanById(trace: Trace, spanID: string) {
  const span = trace.spans.find((s) => s.spanID === spanID);
  if (!span) {
    throw new Error(`span ${spanID} not found in transformed trace`);
  }
  return span;
}

describe('orderTags()', () => {
  it('correctly orders tags', () => {
    const orderedTags = orderTags(
      [
        { key: 'b.ip', value: '8.8.4.4' },
        { key: 'http.Status_code', value: '200' },
        { key: 'z.ip', value: '8.8.8.16' },
        { key: 'a.ip', value: '8.8.8.8' },
        { key: 'http.message', value: 'ok' },
      ],
      ['z.', 'a.', 'HTTP.']
    );
    expect(orderedTags).toEqual([
      { key: 'z.ip', value: '8.8.8.16' },
      { key: 'a.ip', value: '8.8.8.8' },
      { key: 'http.message', value: 'ok' },
      { key: 'http.Status_code', value: '200' },
      { key: 'b.ip', value: '8.8.4.4' },
    ]);
  });

  it('treats non-array tags as empty', () => {
    expect(orderTags('not-an-array' as unknown as TraceKeyValuePair[])).toEqual([]);
    expect(orderTags(undefined as unknown as TraceKeyValuePair[])).toEqual([]);
    expect(orderTags({ key: 'k' } as unknown as TraceKeyValuePair[])).toEqual([]);
  });
});

describe('deduplicateTags()', () => {
  it('deduplicates tags', () => {
    const tagsInfo = deduplicateTags([
      { key: 'b.ip', value: '8.8.4.4' },
      { key: 'b.ip', value: '8.8.8.8' },
      { key: 'b.ip', value: '8.8.4.4' },
      { key: 'a.ip', value: '8.8.8.8' },
    ]);

    expect(tagsInfo.dedupedTags).toEqual([
      { key: 'b.ip', value: '8.8.4.4' },
      { key: 'b.ip', value: '8.8.8.8' },
      { key: 'a.ip', value: '8.8.8.8' },
    ]);
    expect(tagsInfo.warnings).toEqual(['Duplicate tag "b.ip:8.8.4.4"']);
  });

  it('returns empty result for non-array tags', () => {
    expect(deduplicateTags('x' as unknown as TraceKeyValuePair[])).toEqual({
      dedupedTags: [],
      warnings: [],
    });
  });
});

describe('transformTraceData()', () => {
  const startTime = 1586160015434000;
  const duration = 34000;
  const traceID = 'f77950feed55c1ce91dd8e87896623a6';
  const rootSpanID = 'd4dcb46e95b781f5';
  const rootOperationName = 'rootOperation';
  const serviceName = 'serviceName';

  const spans = [
    {
      traceID,
      spanID: '41f71485ed2593e4',
      operationName: 'someOperationName',
      references: [
        {
          refType: 'CHILD_OF',
          traceID,
          spanID: rootSpanID,
        },
      ],
      startTime,
      duration,
      tags: [],
      processID: 'p1',
    },
    {
      traceID,
      spanID: '4f623fd33c213cba',
      operationName: 'anotherOperationName',
      references: [
        {
          refType: 'CHILD_OF',
          traceID,
          spanID: rootSpanID,
        },
      ],
      startTime: startTime + 100,
      duration,
      tags: [],
      processID: 'p1',
    },
  ];

  const rootSpanWithMissingRef = {
    traceID,
    spanID: rootSpanID,
    operationName: rootOperationName,
    references: [
      {
        refType: 'CHILD_OF',
        traceID,
        spanID: 'missingSpanId',
      },
    ],
    startTime: startTime + 50,
    duration,
    tags: [],
    processID: 'p1',
  };

  const rootSpanWithoutRefs = {
    traceID,
    spanID: rootSpanID,
    operationName: rootOperationName,
    startTime: startTime + 50,
    duration,
    tags: [],
    processID: 'p1',
  };

  const processes = {
    p1: {
      serviceName,
      tags: [],
    },
  };

  it('should return null for trace without traceID', () => {
    const traceData = {
      traceID: undefined,
      processes,
      spans,
    } as unknown as TraceResponse;

    expect(transformTraceData(traceData)).toEqual(null);
  });

  it('should return trace data with correct traceName based on root span with missing ref', () => {
    const traceData = {
      traceID,
      processes,
      spans: [...spans, rootSpanWithMissingRef],
    } as unknown as TraceResponse;

    expect(transformTraceData(traceData)!.traceName).toEqual(`${serviceName}: ${rootOperationName}`);
  });

  it('should return trace data with correct traceName based on root span without any refs', () => {
    const traceData = {
      traceID,
      processes,
      spans: [...spans, rootSpanWithoutRefs],
    } as unknown as TraceResponse;

    expect(transformTraceData(traceData)!.traceName).toEqual(`${serviceName}: ${rootOperationName}`);
  });
});

describe('transformTraceData() pruned span detection', () => {
  it('detects a summary span and extracts its default aggregation values', () => {
    const trace = transformTraceData(structuredClone(summaryDefaultsOnly))!;
    const summary = spanById(trace, 'summ00000000a101');

    expect(summary.aggregation).toEqual({
      isSummary: true,
      isPreservedOutlier: false,
      spanCount: 8,
      durationMinNs: 4_000_000,
      durationMaxNs: 60_000_000,
      durationAvgNs: 17_375_000,
    });
    // median is conditional and absent here
    expect(summary.aggregation?.durationMedianNs).toBeUndefined();
  });

  it('leaves normal spans untouched (aggregation undefined)', () => {
    const trace = transformTraceData(structuredClone(summaryDefaultsOnly))!;
    expect(spanById(trace, 'root00000000a101').aggregation).toBeUndefined();
  });

  it('extracts the conditional median when present', () => {
    const trace = transformTraceData(structuredClone(summaryWithConditionalAttrs))!;
    expect(spanById(trace, 'summ00000000b201').aggregation?.durationMedianNs).toBe(9_000_000);
  });

  it('detects a summary span carrying only default attributes', () => {
    const trace = transformTraceData(structuredClone(summaryNoOptionalAttrs))!;
    const summary = spanById(trace, 'summ00000000c301');

    expect(summary.aggregation?.isSummary).toBe(true);
    expect(summary.aggregation?.spanCount).toBe(2);
    expect(summary.aggregation?.durationMedianNs).toBeUndefined();
  });

  it('detects preserved outlier spans and links them back to the summary', () => {
    const trace = transformTraceData(structuredClone(summaryWithPreservedOutliers))!;

    expect(spanById(trace, 'summ00000000d401').aggregation?.isSummary).toBe(true);

    for (const outlierID of ['outl00000000d401', 'outl00000000d402']) {
      const outlier = spanById(trace, outlierID);
      expect(outlier.aggregation).toEqual({
        isSummary: false,
        isPreservedOutlier: true,
        summarySpanId: 'summ00000000d401',
      });
    }
  });

  it('detects summary and outlier spans in a mixed trace while leaving normal spans unaffected', () => {
    const trace = transformTraceData(structuredClone(mixedTrace))!;

    expect(spanById(trace, 'norm00000000e501').aggregation).toBeUndefined();
    expect(spanById(trace, 'norm00000000e502').aggregation).toBeUndefined();
    expect(spanById(trace, 'summ00000000e501').aggregation?.isSummary).toBe(true);
    expect(spanById(trace, 'summ00000000e501').aggregation?.spanCount).toBe(5);

    const outlier = spanById(trace, 'outl00000000e501');
    expect(outlier.aggregation?.isPreservedOutlier).toBe(true);
    expect(outlier.aggregation?.summarySpanId).toBe('summ00000000e501');
  });

  it('extracts aggregation values from a real-data-derived summary span', () => {
    const trace = transformTraceData(structuredClone(summaryAsObservedInOps))!;
    const summary = spanById(trace, 'a1aggsamplerpub1');

    expect(summary.aggregation).toEqual({
      isSummary: true,
      isPreservedOutlier: false,
      spanCount: 5,
      durationMinNs: 164304113,
      durationMaxNs: 215615080,
      durationAvgNs: 195028772,
      durationMedianNs: 215118016,
    });
  });

  // Regression lock for the shared-fixture contract: transformTraceData mutates its input,
  // so callers must clone. This proves repeated transforms are stable AND the singleton is
  // never touched - if a future edit drops a structuredClone, the snapshot assertion fails.
  it('is stable across repeated transforms and never mutates the shared fixture singleton', () => {
    const before = JSON.stringify(summaryDefaultsOnly);

    const first = transformTraceData(structuredClone(summaryDefaultsOnly))!;
    const second = transformTraceData(structuredClone(summaryDefaultsOnly))!;

    expect(spanById(second, 'summ00000000a101').aggregation).toEqual(spanById(first, 'summ00000000a101').aggregation);
    expect(JSON.stringify(summaryDefaultsOnly)).toBe(before);
  });
});
