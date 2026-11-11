// This is the one place allowed to import the exporter's runtime value. transformToOTLP.ts
// imports it as a type only, so the exporter's ~54 module runtime graph stays out of the app
// bundle; tests are not bundled, so importing it here is free.
import { collectorTypes } from '@opentelemetry/exporter-collector';

import { type MutableDataFrame, type TraceSpanRow } from '@grafana/data';

import { SpanKind, transformToOTLP } from './transformToOTLP';

describe('transformToOTLP SpanKind', () => {
  it('mirrors the exporter enum exactly', () => {
    // TypeScript numeric enums are two-way maps at runtime (name -> value and value -> name).
    // Keep only the forward direction so this compares like for like.
    const enumMembers = Object.fromEntries(
      Object.entries(collectorTypes.opentelemetryProto.trace.v1.Span.SpanKind).filter(([key]) =>
        Number.isNaN(Number(key))
      )
    );

    // Fails if a member is added, removed, renamed or renumbered upstream.
    expect(SpanKind).toEqual(enumMembers);
  });
});

describe('transformToOTLP resources', () => {
  const span = (spanID: string, serviceName: string, serviceTags: TraceSpanRow['serviceTags']): TraceSpanRow =>
    ({
      traceID: 'abc',
      spanID,
      operationName: 'op',
      serviceName,
      serviceTags,
      startTime: 1,
      duration: 1,
    }) as TraceSpanRow;
  const frame = (spans: TraceSpanRow[]) => ({ length: spans.length, get: (i: number) => spans[i] }) as MutableDataFrame;
  const podNames = (batches: ReturnType<typeof transformToOTLP>['batches']) =>
    batches.map((batch) => [
      batch.resource!.attributes.find((attr) => attr.key === 'k8s.pod.name')?.value.stringValue,
      batch.instrumentationLibrarySpans[0].spans.map((s) => s.spanId),
    ]);

  it('keeps spans of one service from different resources in separate batches', () => {
    const { batches } = transformToOTLP(
      frame([
        span('1', 'example', [{ key: 'k8s.pod.name', value: 'example-0' }]),
        span('2', 'example', [{ key: 'k8s.pod.name', value: 'example-1' }]),
        span('3', 'example', [{ key: 'k8s.pod.name', value: 'example-0' }]),
      ])
    );

    expect(podNames(batches)).toEqual([
      ['example-0', ['1', '3']],
      ['example-1', ['2']],
    ]);
  });

  it('groups spans whose service tags only differ in order', () => {
    const { batches } = transformToOTLP(
      frame([
        span('1', 'example', [
          { key: 'k8s.pod.name', value: 'example-0' },
          { key: 'host.name', value: 'node-a' },
        ]),
        span('2', 'example', [
          { key: 'host.name', value: 'node-a' },
          { key: 'k8s.pod.name', value: 'example-0' },
        ]),
      ])
    );

    expect(podNames(batches)).toEqual([['example-0', ['1', '2']]]);
  });

  it('still separates spans by service name', () => {
    const { batches } = transformToOTLP(frame([span('1', 'a', []), span('2', 'b', []), span('3', 'a', [])]));

    expect(batches.map((batch) => batch.instrumentationLibrarySpans[0].spans.map((s) => s.spanId))).toEqual([
      ['1', '3'],
      ['2'],
    ]);
  });
});
