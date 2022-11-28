import { v4 as uuidv4 } from 'uuid';

import { SearchResponse, Span, SpanKind, TraceSearchMetadata } from '../types';

export const mockedSearchResponse = (): SearchResponse => {
  const traces: TraceSearchMetadata[] = [];
  const attributes = [
    { 'http.status.code': '500' },
    { 'http.status.code': '200' },
    { 'http.status.code': '404' },
    { job: '"test-job"' },
    { job: '"main-job"' },
    { job: '"long-job"' },
    { error: '"lorem ipsum"' },
    { error: '"something went wrong"' },
  ];

  const tracesCount = Math.random() * 20 + 20;
  for (let i = 0; i < tracesCount; i++) {
    const attr = Math.floor(Math.random() * attributes.length);
    const startTime = (Date.now() - Math.random() * (i + 1) * 100000) * 1000000;
    const t: TraceSearchMetadata = {
      traceID: uuidv4().replace(/-/, '').substring(0, 16),
      rootServiceName: 'service' + i,
      rootTraceName: 'trace' + i,
      startTimeUnixNano: startTime.toString(10),
      durationMs: Math.random() * 1000,
      spanSets: [],
    };

    const spanAttributes = [];
    for (let k = 0; k < Math.random() * 2; k++) {
      const newAttr = Math.floor(Math.random() * attributes.length);
      if (newAttr !== attr) {
        spanAttributes.push(attributes[newAttr]);
      }
    }

    const spans: Span[] = [];
    for (let j = 0; j < Math.random() * 3 + 1; j++) {
      spans.push({
        traceId: t.traceID,
        spanId: uuidv4().replace(/-/, '').substring(0, 16),
        name: uuidv4().replace(/-/, '').substring(0, 6),
        startTimeUnixNano: startTime,
        endTimeUnixNano: startTime + Math.random() * 10000000,
        kind: SpanKind.INTERNAL,
        attributes: spanAttributes,
      });
    }
    t.spanSets!.push({ spans, attributes: [attributes[attr]] });
    traces.push(t);
  }

  return {
    traces,
    metrics: {
      inspectedTraces: tracesCount,
      inspectedBytes: 83720,
    },
  };
};
