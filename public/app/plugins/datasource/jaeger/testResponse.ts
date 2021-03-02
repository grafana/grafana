import { TraceResponse } from './types';

export const testResponse: TraceResponse = {
  traceID: '3fa414edcef6ad90',
  spans: [
    {
      traceID: '3fa414edcef6ad90',
      spanID: '3fa414edcef6ad90',
      operationName: 'HTTP GET - api_traces_traceid',
      references: [],
      startTime: 1605873894680409,
      duration: 1049141,
      tags: [
        { key: 'sampler.type', type: 'string', value: 'probabilistic' },
        { key: 'sampler.param', type: 'float64', value: 1 },
      ],
      logs: [],
      processID: 'p1',
      warnings: null,
      flags: 0,
    },
    {
      traceID: '3fa414edcef6ad90',
      spanID: '0f5c1808567e4403',
      operationName: '/tempopb.Querier/FindTraceByID',
      references: [{ refType: 'CHILD_OF', traceID: '3fa414edcef6ad90', spanID: '3fa414edcef6ad90' }],
      startTime: 1605873894680587,
      duration: 1847,
      tags: [
        { key: 'component', type: 'string', value: 'gRPC' },
        { key: 'span.kind', type: 'string', value: 'client' },
      ],
      logs: [],
      processID: 'p1',
      warnings: null,
      flags: 0,
    },
  ],
  processes: {
    p1: {
      serviceName: 'tempo-querier',
      tags: [
        { key: 'cluster', type: 'string', value: 'ops-tools1' },
        { key: 'container', type: 'string', value: 'tempo-query' },
      ],
    },
  },
  warnings: null,
};
