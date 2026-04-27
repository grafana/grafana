import { createDataFrame } from '@grafana/data/dataframe';

import { transformTraceDataFrame } from './transform';

describe('transformTraceDataFrame()', () => {
  const fields = [
    { name: 'traceID', values: ['trace1'] },
    { name: 'operationName', values: ['operation1'] },
    { name: 'kind', values: ['server'] },
    { name: 'tags', values: [[{ key: 'key1', value: 'value1' }]] },
  ];

  it('should return transformed data', () => {
    const dummyDataFrame = createDataFrame({
      fields: fields.concat([...fields, { name: 'spanID', values: ['span1'] }]),
    });
    expect(transformTraceDataFrame(dummyDataFrame)).toEqual({
      processes: { span1: { serviceName: undefined, serviceNamespace: undefined, tags: [] } },
      spans: [
        {
          dataFrameRowIndex: 0,
          duration: NaN,
          flags: 0,
          kind: 'server',
          logs: [],
          operationName: 'operation1',
          processID: 'span1',
          references: [],
          spanID: 'span1',
          startTime: NaN,
          tags: [{ key: 'key1', value: 'value1' }],
          traceID: 'trace1',
        },
      ],
      traceID: 'trace1',
    });
  });

  it('should return null for any span without a spanID', () => {
    const dummyDataFrame = createDataFrame({
      fields: fields,
    });
    expect(transformTraceDataFrame(dummyDataFrame)).toEqual(null);
  });

  it('should map serviceNamespace from DataFrame into process when present', () => {
    const frameWithNamespace = createDataFrame({
      fields: [
        { name: 'traceID', values: ['trace1'] },
        { name: 'spanID', values: ['span1'] },
        { name: 'operationName', values: ['GET /api'] },
        { name: 'serviceName', values: ['cart-service'] },
        { name: 'serviceNamespace', values: ['production'] },
        { name: 'kind', values: ['server'] },
        { name: 'tags', values: [[]] },
      ],
    });
    const result = transformTraceDataFrame(frameWithNamespace);
    expect(result).not.toBeNull();
    expect(result!.processes['span1']).toEqual({
      serviceName: 'cart-service',
      serviceNamespace: 'production',
      tags: [],
    });
  });
});
