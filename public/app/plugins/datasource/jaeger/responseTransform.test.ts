import { createTraceFrame } from './responseTransform';
import { ArrayVector } from '@grafana/data';
import { testResponse } from './testResponse';

describe('createTraceFrame', () => {
  it('creates data frame from jaeger response', () => {
    const dataFrame = createTraceFrame(testResponse);
    expect(dataFrame.fields).toMatchObject(
      [
        { name: 'traceID', values: ['3fa414edcef6ad90', '3fa414edcef6ad90'] },
        { name: 'spanID', values: ['3fa414edcef6ad90', '0f5c1808567e4403'] },
        { name: 'parentSpanID', values: [undefined, '3fa414edcef6ad90'] },
        { name: 'operationName', values: ['HTTP GET - api_traces_traceid', '/tempopb.Querier/FindTraceByID'] },
        { name: 'serviceName', values: ['tempo-querier', 'tempo-querier'] },
        {
          name: 'serviceTags',
          values: [
            [
              { key: 'cluster', type: 'string', value: 'ops-tools1' },
              { key: 'container', type: 'string', value: 'tempo-query' },
            ],
            [
              { key: 'cluster', type: 'string', value: 'ops-tools1' },
              { key: 'container', type: 'string', value: 'tempo-query' },
            ],
          ],
        },
        { name: 'startTime', values: [1605873894680.409, 1605873894680.587] },
        { name: 'duration', values: [1049.141, 1.847] },
        { name: 'logs', values: [[], []] },
        {
          name: 'tags',
          values: [
            [
              { key: 'sampler.type', type: 'string', value: 'probabilistic' },
              { key: 'sampler.param', type: 'float64', value: 1 },
            ],
            [
              { key: 'component', type: 'string', value: 'gRPC' },
              { key: 'span.kind', type: 'string', value: 'client' },
            ],
          ],
        },
        { name: 'warnings', values: [undefined, undefined] },
        { name: 'stackTraces', values: [undefined, undefined] },
      ].map((f) => ({ ...f, values: new ArrayVector<any>(f.values) }))
    );
  });
});
