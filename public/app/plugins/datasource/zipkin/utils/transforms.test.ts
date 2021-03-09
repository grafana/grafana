import { transformResponse } from './transforms';
import { zipkinResponse } from './testData';
import { ArrayVector } from '@grafana/data';

describe('transformResponse', () => {
  it('transforms response', () => {
    const dataFrame = transformResponse(zipkinResponse);

    expect(dataFrame.fields).toMatchObject(
      [
        { name: 'traceID', values: ['trace_id', 'trace_id', 'trace_id'] },
        { name: 'spanID', values: ['span 1 id', 'span 2 id', 'span 3 id'] },
        { name: 'parentSpanID', values: [undefined, 'span 1 id', 'span 1 id'] },
        { name: 'operationName', values: ['span 1', 'span 2', 'span 3'] },
        { name: 'serviceName', values: ['service 1', 'service 2', 'spanstore-jdbc'] },
        {
          name: 'serviceTags',
          values: [
            [
              { key: 'ipv4', value: '1.0.0.1' },
              { key: 'port', value: 42 },
            ],
            [{ key: 'ipv4', value: '1.0.0.1' }],
            [{ key: 'ipv6', value: '127.0.0.1' }],
          ],
        },
        { name: 'startTime', values: [0.001, 0.004, 0.006] },
        { name: 'duration', values: [0.01, 0.005, 0.007] },
        {
          name: 'logs',
          values: [
            [
              {
                timestamp: 2,
                fields: [
                  {
                    key: 'annotation',
                    value: 'annotation text',
                  },
                ],
              },
              {
                timestamp: 6,
                fields: [
                  {
                    key: 'annotation',
                    value: 'annotation text 3',
                  },
                ],
              },
            ],
            [],
            [],
          ],
        },
        {
          name: 'tags',
          values: [
            [
              { key: 'kind', value: 'CLIENT' },
              { key: 'tag1', value: 'val1' },
              { key: 'tag2', value: 'val2' },
            ],
            [
              { key: 'error', value: true },
              { key: 'errorValue', value: '404' },
            ],
            [],
          ],
        },
      ].map((f) => ({ ...f, values: new ArrayVector<any>(f.values) }))
    );
  });
});
