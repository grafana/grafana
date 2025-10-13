import { FieldType, MutableDataFrame } from '@grafana/data';

export const otlpDataFrameFromResponse = new MutableDataFrame({
  meta: {
    preferredVisualisationType: 'trace',
    custom: {
      traceFormat: 'otlp',
    },
  },
  fields: [
    {
      name: 'traceID',
      type: FieldType.string,
      config: {},
      values: ['60ba2abb44f13eae'],
    },
    {
      name: 'spanID',
      type: FieldType.string,
      config: {},
      values: ['726b5e30102fc0d0'],
    },
    {
      name: 'parentSpanID',
      type: FieldType.string,
      config: {},
      values: ['398f0f21a3db99ae'],
    },
    {
      name: 'operationName',
      type: FieldType.string,
      config: {},
      values: ['HTTP GET - root'],
    },
    {
      name: 'serviceName',
      type: FieldType.string,
      config: {},
      values: ['db'],
    },
    {
      name: 'kind',
      type: FieldType.string,
      config: {},
      values: ['client'],
    },
    {
      name: 'statusCode',
      type: FieldType.number,
      config: {},
      values: [2],
    },
    {
      name: 'statusMessage',
      type: FieldType.string,
      config: {},
      values: ['message'],
    },
    {
      name: 'instrumentationLibraryName',
      type: FieldType.string,
      config: {},
      values: ['libraryName'],
    },
    {
      name: 'instrumentationLibraryVersion',
      type: FieldType.string,
      config: {},
      values: ['libraryVersion'],
    },
    {
      name: 'traceState',
      type: FieldType.string,
      config: {},
      values: ['traceState'],
    },
    {
      name: 'serviceTags',
      type: FieldType.other,
      config: {},
      values: [
        [
          {
            key: 'service.name',
            value: 'db',
          },
          {
            key: 'job',
            value: 'tns/db',
          },
          {
            key: 'opencensus.exporterversion',
            value: 'Jaeger-Go-2.22.1',
          },
          {
            key: 'host.name',
            value: '63d16772b4a2',
          },
          {
            key: 'ip',
            value: '0.0.0.0',
          },
          {
            key: 'client-uuid',
            value: '39fb01637a579639',
          },
        ],
      ],
    },
    {
      name: 'startTime',
      type: FieldType.number,
      config: {},
      values: [1627471657255.809],
    },
    {
      name: 'duration',
      type: FieldType.number,
      config: {},
      values: [0.459008],
    },
    {
      name: 'logs',
      type: FieldType.other,
      config: {},
      values: [[{ name: 'DNSDone', fields: [{ key: 'addr', value: '172.18.0.6' }] }]],
    },
    {
      name: 'references',
      type: FieldType.other,
      config: {},
      values: [
        [
          {
            spanID: 'spanId',
            traceID: 'traceId',
            tags: [
              { key: 'key', value: 'Value' },
              { key: 'intValue', value: 4 },
            ],
          },
          {
            spanID: 'spanId2',
            traceID: 'traceId2',
            tags: [],
          },
        ],
      ],
    },
    {
      name: 'tags',
      type: FieldType.other,
      config: {},
      values: [
        [
          {
            key: 'http.status_code',
            value: 200,
          },
          {
            key: 'http.method',
            value: 'GET',
          },
          {
            key: 'http.url',
            value: '/',
          },
          {
            key: 'component',
            value: 'net/http',
          },
        ],
      ],
    },
  ],
  length: 1,
});

export const otlpDataFrameToResponse = new MutableDataFrame({
  meta: {
    preferredVisualisationType: 'trace',
    custom: {
      traceFormat: 'otlp',
    },
  },
  fields: [
    {
      name: 'traceID',
      type: FieldType.string,
      config: {},
      values: ['60ba2abb44f13eae'],
      state: {
        displayName: 'traceID',
      },
    },
    {
      name: 'spanID',
      type: FieldType.string,
      config: {},
      values: ['726b5e30102fc0d0'],
      state: {
        displayName: 'spanID',
      },
    },
    {
      name: 'parentSpanID',
      type: FieldType.string,
      config: {},
      values: ['398f0f21a3db99ae'],
      state: {
        displayName: 'parentSpanID',
      },
    },
    {
      name: 'operationName',
      type: FieldType.string,
      config: {},
      values: ['HTTP GET - root'],
      state: {
        displayName: 'operationName',
      },
    },
    {
      name: 'serviceName',
      type: FieldType.string,
      config: {},
      values: ['db'],
      state: {
        displayName: 'serviceName',
      },
    },
    {
      name: 'kind',
      type: FieldType.string,
      config: {},
      values: ['client'],
      state: {
        displayName: 'kind',
      },
    },
    {
      name: 'statusCode',
      type: FieldType.number,
      config: {},
      values: [2],
      state: {
        displayName: 'statusCode',
      },
    },
    {
      name: 'statusMessage',
      type: FieldType.string,
      config: {},
      values: ['message'],
      state: {
        displayName: 'statusMessage',
      },
    },
    {
      name: 'instrumentationLibraryName',
      type: FieldType.string,
      config: {},
      values: ['libraryName'],
      state: {
        displayName: 'instrumentationLibraryName',
      },
    },
    {
      name: 'instrumentationLibraryVersion',
      type: FieldType.string,
      config: {},
      values: ['libraryVersion'],
      state: {
        displayName: 'instrumentationLibraryVersion',
      },
    },
    {
      name: 'traceState',
      type: FieldType.string,
      config: {},
      values: ['traceState'],
      state: {
        displayName: 'traceState',
      },
    },
    {
      name: 'serviceTags',
      type: FieldType.other,
      config: {},
      values: [
        [
          {
            key: 'service.name',
            value: 'db',
          },
          {
            key: 'job',
            value: 'tns/db',
          },
          {
            key: 'opencensus.exporterversion',
            value: 'Jaeger-Go-2.22.1',
          },
          {
            key: 'host.name',
            value: '63d16772b4a2',
          },
          {
            key: 'ip',
            value: '0.0.0.0',
          },
          {
            key: 'client-uuid',
            value: '39fb01637a579639',
          },
        ],
      ],
      state: {
        displayName: 'serviceTags',
      },
    },
    {
      name: 'startTime',
      type: FieldType.number,
      config: {},
      values: [1627471657255.809],
      state: {
        displayName: 'startTime',
      },
    },
    {
      name: 'duration',
      type: FieldType.number,
      config: {},
      values: [0.459008],
      state: {
        displayName: 'duration',
      },
    },
    {
      name: 'logs',
      type: FieldType.other,
      config: {},
      values: [
        [
          {
            fields: [
              {
                key: 'addr',
                value: '172.18.0.6',
              },
            ],
            timestamp: 1627471657255.809,
            name: 'DNSDone',
          },
        ],
      ],
      state: {
        displayName: 'logs',
      },
    },
    {
      name: 'tags',
      type: FieldType.other,
      config: {},
      values: [
        [
          {
            key: 'http.status_code',
            value: 200,
          },
          {
            key: 'http.method',
            value: 'GET',
          },
          {
            key: 'http.url',
            value: '/',
          },
          {
            key: 'component',
            value: 'net/http',
          },
        ],
      ],
      state: {
        displayName: 'tags',
      },
    },
    {
      name: 'references',
      type: FieldType.other,
      config: {},
      labels: undefined,
      values: [
        [
          {
            spanID: 'spanId',
            traceID: 'traceId',
            tags: [
              { key: 'key', value: 'Value' },
              { key: 'intValue', value: 4 },
            ],
          },
          {
            spanID: 'spanId2',
            traceID: 'traceId2',
            tags: [],
          },
        ],
      ],
      state: {
        displayName: 'references',
      },
    },
  ],
  length: 1,
});

export const otlpResponse = {
  batches: [
    {
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'db' } },
          { key: 'job', value: { stringValue: 'tns/db' } },
          { key: 'opencensus.exporterversion', value: { stringValue: 'Jaeger-Go-2.22.1' } },
          { key: 'host.name', value: { stringValue: '63d16772b4a2' } },
          { key: 'ip', value: { stringValue: '0.0.0.0' } },
          { key: 'client-uuid', value: { stringValue: '39fb01637a579639' } },
        ],
      },
      instrumentationLibrarySpans: [
        {
          instrumentationLibrary: {
            name: 'libraryName',
            version: 'libraryVersion',
          },
          spans: [
            {
              traceId: '000000000000000060ba2abb44f13eae',
              spanId: '726b5e30102fc0d0',
              parentSpanId: '398f0f21a3db99ae',
              name: 'HTTP GET - root',
              kind: 'SPAN_KIND_CLIENT',
              status: {
                code: 2,
                message: 'message',
              },
              traceState: 'traceState',
              startTimeUnixNano: 1627471657255809000,
              endTimeUnixNano: 1627471657256268000,
              attributes: [
                { key: 'http.status_code', value: { intValue: 200 } },
                { key: 'http.method', value: { stringValue: 'GET' } },
                { key: 'http.url', value: { stringValue: '/' } },
                { key: 'component', value: { stringValue: 'net/http' } },
              ],
              events: [
                {
                  name: 'DNSDone',
                  attributes: [{ key: 'addr', value: { stringValue: '172.18.0.6' } }],
                  droppedAttributesCount: 0,
                  timeUnixNano: 1627471657255809000,
                },
              ],
              links: [
                {
                  spanId: 'spanId',
                  traceId: 'traceId',
                  attributes: [
                    {
                      key: 'key',
                      value: {
                        stringValue: 'Value',
                      },
                    },
                    {
                      key: 'intValue',
                      value: {
                        intValue: 4,
                      },
                    },
                  ],
                },
                {
                  spanId: 'spanId2',
                  traceId: 'traceId2',
                  attributes: [],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export const traceQlResponse = {
  traces: [
    {
      traceID: 'b1586c3c8c34d',
      rootServiceName: 'lb',
      rootTraceName: 'HTTP Client',
      startTimeUnixNano: '1643356828724000000',
      durationMs: 65,
      spanSet: {
        spans: [
          {
            spanID: '162a4adae63b61f1',
            startTimeUnixNano: '1666188214303201000',
            durationNanos: '545000',
            attributes: [
              {
                key: 'http.method',
                value: {
                  stringValue: 'GET',
                },
              },
              {
                key: 'service.name',
                value: {
                  stringValue: 'db',
                },
              },
            ],
          },
          {
            spanID: '15991be3a92136e6',
            startTimeUnixNano: '1666188214300239000',
            durationNanos: '6686000',
            attributes: [
              {
                key: 'http.method',
                value: {
                  stringValue: 'GET',
                },
              },
              {
                key: 'service.name',
                value: {
                  stringValue: 'app',
                },
              },
            ],
          },
          {
            spanID: '5e91b69dc224c240',
            startTimeUnixNano: '1666188214300647000',
            durationNanos: '6043000',
            attributes: [
              {
                key: 'http.method',
                value: {
                  stringValue: 'GET',
                },
              },
              {
                key: 'service.name',
                value: {
                  stringValue: 'app',
                },
              },
            ],
          },
          {
            spanID: '29f218a50b00c306',
            startTimeUnixNano: '1666188214297891000',
            durationNanos: '8365000',
            attributes: [
              {
                key: 'http.method',
                value: {
                  stringValue: 'GET',
                },
              },
              {
                key: 'service.name',
                value: {
                  stringValue: 'lb',
                },
              },
            ],
          },
        ],
        matched: 4,
      },
    },
    {
      traceID: '9161e77388f3e',
      rootServiceName: 'lb',
      rootTraceName: 'HTTP Client',
      startTimeUnixNano: '1643342166678000000',
      spanSets: [
        {
          attributes: [
            {
              key: 'by(resource.service.name)',
              value: {
                stringValue: 'db',
              },
            },
          ],
          spans: [
            {
              spanID: '3b9a5c222d3ddd8f',
              startTimeUnixNano: '1666187875397721000',
              durationNanos: '877000',
              attributes: [
                {
                  key: 'http.method',
                  value: {
                    stringValue: 'GET',
                  },
                },
                {
                  key: 'service.name',
                  value: {
                    stringValue: 'db',
                  },
                },
              ],
            },
          ],
          matched: 1,
        },
        {
          attributes: [
            {
              key: 'by(resource.service.name)',
              value: {
                stringValue: 'app',
              },
            },
          ],
          spans: [
            {
              spanID: '894d90db6b5807f',
              startTimeUnixNano: '1666187875393293000',
              durationNanos: '11073000',
              attributes: [
                {
                  key: 'http.method',
                  value: {
                    stringValue: 'GET',
                  },
                },
                {
                  key: 'service.name',
                  value: {
                    stringValue: 'app',
                  },
                },
              ],
            },
            {
              spanID: 'd3284e9c5081aab',
              startTimeUnixNano: '1666187875393897000',
              durationNanos: '10133000',
              attributes: [
                {
                  key: 'service.name',
                  value: {
                    stringValue: 'app',
                  },
                },
                {
                  key: 'http.method',
                  value: {
                    stringValue: 'GET',
                  },
                },
              ],
            },
          ],
          matched: 2,
        },
      ],
    },
    {
      traceID: '480691f7c6f20',
      rootServiceName: 'lb',
      rootTraceName: 'HTTP Client',
      startTimeUnixNano: '1643342166678000000',
      durationMs: 44,
      spanSet: {
        spans: [
          {
            spanID: '2ab970c9db57d100',
            startTimeUnixNano: '1666186467658853000',
            durationNanos: '436000',
            attributes: [
              {
                key: 'http.method',
                value: {
                  stringValue: 'GET',
                },
              },
              {
                key: 'service.name',
                value: {
                  stringValue: 'db',
                },
              },
            ],
          },
          {
            spanID: '3a4070e418857cbd',
            startTimeUnixNano: '1666186467657066000',
            durationNanos: '5503000',
            attributes: [
              {
                key: 'http.method',
                value: {
                  stringValue: 'GET',
                },
              },
              {
                key: 'service.name',
                value: {
                  stringValue: 'app',
                },
              },
            ],
          },
          {
            spanID: '7ddf87d7a3f864c8',
            startTimeUnixNano: '1666186467657336000',
            durationNanos: '5005000',
            attributes: [
              {
                key: 'http.method',
                value: {
                  stringValue: 'GET',
                },
              },
              {
                key: 'service.name',
                value: {
                  stringValue: 'app',
                },
              },
            ],
          },
          {
            spanID: '241e9f31609056c5',
            startTimeUnixNano: '1666186467655299000',
            durationNanos: '6413000',
            attributes: [
              {
                key: 'http.method',
                value: {
                  stringValue: 'GET',
                },
              },
              {
                key: 'service.name',
                value: {
                  stringValue: 'lb',
                },
              },
            ],
          },
        ],
        matched: 4,
      },
    },
  ],
  metrics: {
    inspectedBlocks: 5,
    totalBlockBytes: '9092129',
  },
};

export const badOTLPResponse = {
  batches: [
    {
      resource: {},
      instrumentationLibrarySpans: [
        {
          spans: [
            {
              traceId: 'AAAAAAAAAABguiq7RPE+rg==',
              spanId: 'cmteMBAvwNA=',
              parentSpanId: 'OY8PIaPbma4=',
              name: 'HTTP GET - root',
              kind: 'SPAN_KIND_CLIENT',
              startTimeUnixNano: 1627471657255809000,
              endTimeUnixNano: 1627471657256268000,
              attributes: [
                { key: 'http.status_code', value: { intValue: 200 } },
                { key: 'http.method', value: { stringValue: 'GET' } },
                { key: 'http.url', value: { stringValue: '/' } },
                { key: 'component', value: { stringValue: 'net/http' } },
              ],
            },
          ],
        },
      ],
    },
  ],
};
