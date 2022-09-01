import { v4 as uuidv4 } from 'uuid';

import { SearchResponse, TraceSearchMetadata } from '../types';

export const mockedSearchResponse = (): SearchResponse => {
  const traces: TraceSearchMetadata[] = [];

  const tracesCount = Math.random() * 20 + 20;
  for (let i = 0; i < tracesCount; i++) {
    traces.push({
      traceID: uuidv4().replace(/-/, '').substring(0, 16),
      rootServiceName: 'service' + i,
      rootTraceName: 'trace' + i,
      startTimeUnixNano: ((Date.now() - Math.random() * (i + 1) * 100000) * 1000000).toString(10),
      durationMs: Math.random() * 1000,
    });
  }

  return {
    traces,
    metrics: {
      inspectedTraces: tracesCount,
      inspectedBytes: 83720,
    },
  };
};
