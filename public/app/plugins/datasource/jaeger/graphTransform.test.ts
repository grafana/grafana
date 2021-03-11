import { createGraphFrames } from './graphTransform';
import {
  testResponse,
  testResponseEdgesFields,
  testResponseNodesFields,
  toEdgesFrame,
  toNodesFrame,
} from './testResponse';
import { TraceResponse } from './types';

describe('createGraphFrames', () => {
  it('transforms basic response into nodes and edges frame', async () => {
    const frames = createGraphFrames(testResponse);
    expect(frames.length).toBe(2);
    expect(frames[0].fields).toMatchObject(testResponseNodesFields);
    expect(frames[1].fields).toMatchObject(testResponseEdgesFields);
  });

  it('handles single span response', async () => {
    const frames = createGraphFrames(singleSpanResponse);
    expect(frames.length).toBe(2);
    expect(frames[0].fields).toMatchObject(
      toNodesFrame([
        ['3fa414edcef6ad90'],
        ['tempo-querier'],
        ['HTTP GET - api_traces_traceid'],
        ['total: 1049.14ms (100%)'],
        ['self: 1049.14ms (100%)'],
        [1],
      ])
    );
    expect(frames[1].fields).toMatchObject(toEdgesFrame([[], [], []]));
  });
});

export const singleSpanResponse: TraceResponse = {
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
