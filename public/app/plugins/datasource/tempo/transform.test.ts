import { transformResponse } from './transform';

describe('transformResponse', () => {
  it('transforms response', () => {
    expect(transformResponse(otlResponse as any, 'id')).toEqual(transFormed);
  });
});

const otlResponse = {
  batches: [
    {
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'app' } },
          { key: 'cluster', value: { stringValue: 'tns' } },
          { key: 'namespace', value: { stringValue: 'tns' } },
          { key: 'opencensus.exporterversion', value: { stringValue: 'Jaeger-Go-2.22.1' } },
          { key: 'host.hostname', value: { stringValue: '9549a52e8f76' } },
          { key: 'ip', value: { stringValue: '172.21.0.6' } },
          { key: 'client-uuid', value: { stringValue: '20a8528f1d337232' } },
        ],
      },
      instrumentationLibrarySpans: [
        {
          spans: [
            {
              traceId: 'AAAAAAAAAAA7sfBY17Slyg==',
              spanId: 'cXuFYRga5Ls=',
              parentSpanId: 'FOl6XNj2TZU=',
              name: 'HTTP Client',
              startTimeUnixNano: '1613672729934074000',
              endTimeUnixNano: '1613672730037272000',
            },
          ],
        },
      ],
    },
    {
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'db' } },
          { key: 'cluster', value: { stringValue: 'tns' } },
          { key: 'namespace', value: { stringValue: 'tns' } },
          { key: 'opencensus.exporterversion', value: { stringValue: 'Jaeger-Go-2.22.1' } },
          { key: 'host.hostname', value: { stringValue: '86b3221ed80f' } },
          { key: 'ip', value: { stringValue: '172.21.0.4' } },
          { key: 'client-uuid', value: { stringValue: '177e9777791dfe05' } },
        ],
      },
      instrumentationLibrarySpans: [
        {
          spans: [
            {
              traceId: 'AAAAAAAAAAA7sfBY17Slyg==',
              spanId: 'FmAdJLsJ1IA=',
              parentSpanId: 'AFqcMsSMZ5o=',
              name: 'HTTP GET - root',
              kind: 'SERVER',
              startTimeUnixNano: '1613672729937973000',
              endTimeUnixNano: '1613672730036055000',
              attributes: [
                { key: 'http.status_code', value: { intValue: '500' } },
                { key: 'http.method', value: { stringValue: 'GET' } },
                { key: 'http.url', value: { stringValue: '/' } },
                { key: 'component', value: { stringValue: 'net/http' } },
              ],
              status: { code: 'InternalError' },
            },
          ],
        },
      ],
    },
    {
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'lb' } },
          { key: 'cluster', value: { stringValue: 'tns' } },
          { key: 'namespace', value: { stringValue: 'tns' } },
          { key: 'opencensus.exporterversion', value: { stringValue: 'Jaeger-Go-2.22.1' } },
          { key: 'host.hostname', value: { stringValue: '6f058f383a0c' } },
          { key: 'ip', value: { stringValue: '172.21.0.2' } },
          { key: 'client-uuid', value: { stringValue: '1b26be644b89525f' } },
        ],
      },
      instrumentationLibrarySpans: [
        {
          spans: [
            {
              traceId: 'AAAAAAAAAAA7sfBY17Slyg==',
              spanId: 'O7HwWNe0pco=',
              name: 'HTTP Client',
              startTimeUnixNano: '1613672729926420000',
              endTimeUnixNano: '1613672730038573000',
              attributes: [
                { key: 'sampler.type', value: { stringValue: 'const' } },
                { key: 'sampler.param', value: { boolValue: true } },
              ],
            },
          ],
        },
      ],
    },
    {
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'app' } },
          { key: 'cluster', value: { stringValue: 'tns' } },
          { key: 'namespace', value: { stringValue: 'tns' } },
          { key: 'opencensus.exporterversion', value: { stringValue: 'Jaeger-Go-2.22.1' } },
          { key: 'host.hostname', value: { stringValue: '9549a52e8f76' } },
          { key: 'ip', value: { stringValue: '172.21.0.6' } },
          { key: 'client-uuid', value: { stringValue: '20a8528f1d337232' } },
        ],
      },
      instrumentationLibrarySpans: [
        {
          spans: [
            {
              traceId: 'AAAAAAAAAAA7sfBY17Slyg==',
              spanId: 'AFqcMsSMZ5o=',
              parentSpanId: 'cXuFYRga5Ls=',
              name: 'HTTP GET',
              kind: 'CLIENT',
              startTimeUnixNano: '1613672729934101000',
              endTimeUnixNano: '1613672730037344000',
              attributes: [
                { key: 'http.status_code', value: { intValue: '500' } },
                { key: 'component', value: { stringValue: 'net/http' } },
                { key: 'http.method', value: { stringValue: 'GET' } },
                { key: 'http.url', value: { stringValue: 'db:80' } },
                { key: 'net/http.reused', value: { boolValue: false } },
                { key: 'net/http.was_idle', value: { boolValue: false } },
              ],
              events: [
                {
                  timeUnixNano: '1613672729934142000',
                  attributes: [{ key: 'event', value: { stringValue: 'GetConn' } }],
                },
                {
                  timeUnixNano: '1613672729934286000',
                  attributes: [
                    { key: 'event', value: { stringValue: 'DNSStart' } },
                    { key: 'host', value: { stringValue: 'db' } },
                  ],
                },
                {
                  timeUnixNano: '1613672729936343000',
                  attributes: [
                    { key: 'event', value: { stringValue: 'DNSDone' } },
                    { key: 'addr', value: { stringValue: '172.21.0.4' } },
                  ],
                },
                {
                  timeUnixNano: '1613672729936399000',
                  attributes: [
                    { key: 'event', value: { stringValue: 'ConnectStart' } },
                    { key: 'network', value: { stringValue: 'tcp' } },
                    { key: 'addr', value: { stringValue: '172.21.0.4:80' } },
                  ],
                },
                {
                  timeUnixNano: '1613672729937041000',
                  attributes: [
                    { key: 'event', value: { stringValue: 'ConnectDone' } },
                    { key: 'network', value: { stringValue: 'tcp' } },
                    { key: 'addr', value: { stringValue: '172.21.0.4:80' } },
                  ],
                },
                {
                  timeUnixNano: '1613672729937123000',
                  attributes: [{ key: 'event', value: { stringValue: 'GotConn' } }],
                },
                {
                  timeUnixNano: '1613672729937473000',
                  attributes: [{ key: 'event', value: { stringValue: 'WroteHeaders' } }],
                },
                {
                  timeUnixNano: '1613672729937497000',
                  attributes: [{ key: 'event', value: { stringValue: 'WroteRequest' } }],
                },
                {
                  timeUnixNano: '1613672730036696000',
                  attributes: [{ key: 'event', value: { stringValue: 'GotFirstResponseByte' } }],
                },
                {
                  timeUnixNano: '1613672730037331000',
                  attributes: [{ key: 'event', value: { stringValue: 'ClosedBody' } }],
                },
              ],
              status: { code: 'InternalError' },
            },
          ],
        },
      ],
    },
    {
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'lb' } },
          { key: 'cluster', value: { stringValue: 'tns' } },
          { key: 'namespace', value: { stringValue: 'tns' } },
          { key: 'opencensus.exporterversion', value: { stringValue: 'Jaeger-Go-2.22.1' } },
          { key: 'host.hostname', value: { stringValue: '6f058f383a0c' } },
          { key: 'ip', value: { stringValue: '172.21.0.2' } },
          { key: 'client-uuid', value: { stringValue: '1b26be644b89525f' } },
        ],
      },
      instrumentationLibrarySpans: [
        {
          spans: [
            {
              traceId: 'AAAAAAAAAAA7sfBY17Slyg==',
              spanId: 'Tay5Su2jkGU=',
              parentSpanId: 'O7HwWNe0pco=',
              name: 'HTTP GET',
              kind: 'CLIENT',
              startTimeUnixNano: '1613672729926451000',
              endTimeUnixNano: '1613672730039402000',
              attributes: [
                { key: 'http.status_code', value: { intValue: '500' } },
                { key: 'component', value: { stringValue: 'net/http' } },
                { key: 'http.method', value: { stringValue: 'GET' } },
                { key: 'http.url', value: { stringValue: 'app:80' } },
                { key: 'net/http.reused', value: { boolValue: false } },
                { key: 'net/http.was_idle', value: { boolValue: false } },
              ],
              events: [
                {
                  timeUnixNano: '1613672729926514000',
                  attributes: [{ key: 'event', value: { stringValue: 'GetConn' } }],
                },
                {
                  timeUnixNano: '1613672729926879000',
                  attributes: [
                    { key: 'event', value: { stringValue: 'DNSStart' } },
                    { key: 'host', value: { stringValue: 'app' } },
                  ],
                },
                {
                  timeUnixNano: '1613672729930597000',
                  attributes: [
                    { key: 'event', value: { stringValue: 'DNSDone' } },
                    { key: 'addr', value: { stringValue: '172.21.0.6' } },
                  ],
                },
                {
                  timeUnixNano: '1613672729930651000',
                  attributes: [
                    { key: 'event', value: { stringValue: 'ConnectStart' } },
                    { key: 'network', value: { stringValue: 'tcp' } },
                    { key: 'addr', value: { stringValue: '172.21.0.6:80' } },
                  ],
                },
                {
                  timeUnixNano: '1613672729931347000',
                  attributes: [
                    { key: 'event', value: { stringValue: 'ConnectDone' } },
                    { key: 'network', value: { stringValue: 'tcp' } },
                    { key: 'addr', value: { stringValue: '172.21.0.6:80' } },
                  ],
                },
                {
                  timeUnixNano: '1613672729931736000',
                  attributes: [{ key: 'event', value: { stringValue: 'GotConn' } }],
                },
                {
                  timeUnixNano: '1613672729931906000',
                  attributes: [{ key: 'event', value: { stringValue: 'WroteHeaders' } }],
                },
                {
                  timeUnixNano: '1613672729931932000',
                  attributes: [{ key: 'event', value: { stringValue: 'WroteRequest' } }],
                },
                {
                  timeUnixNano: '1613672730038167000',
                  attributes: [{ key: 'event', value: { stringValue: 'GotFirstResponseByte' } }],
                },
                {
                  timeUnixNano: '1613672730039395000',
                  attributes: [{ key: 'event', value: { stringValue: 'ClosedBody' } }],
                },
              ],
              status: { code: 'InternalError' },
            },
          ],
        },
      ],
    },
    {
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'app' } },
          { key: 'cluster', value: { stringValue: 'tns' } },
          { key: 'namespace', value: { stringValue: 'tns' } },
          { key: 'opencensus.exporterversion', value: { stringValue: 'Jaeger-Go-2.22.1' } },
          { key: 'host.hostname', value: { stringValue: '9549a52e8f76' } },
          { key: 'ip', value: { stringValue: '172.21.0.6' } },
          { key: 'client-uuid', value: { stringValue: '20a8528f1d337232' } },
        ],
      },
      instrumentationLibrarySpans: [
        {
          spans: [
            {
              traceId: 'AAAAAAAAAAA7sfBY17Slyg==',
              spanId: 'FOl6XNj2TZU=',
              parentSpanId: 'Tay5Su2jkGU=',
              name: 'HTTP GET - root',
              kind: 'SERVER',
              startTimeUnixNano: '1613672729933861000',
              endTimeUnixNano: '1613672730037620000',
              attributes: [
                { key: 'http.status_code', value: { intValue: '500' } },
                { key: 'http.method', value: { stringValue: 'GET' } },
                { key: 'http.url', value: { stringValue: '/' } },
                { key: 'component', value: { stringValue: 'net/http' } },
              ],
              status: { code: 'InternalError' },
            },
          ],
        },
      ],
    },
  ],
};

const transFormed = {
  processes: {
    app: {
      serviceName: 'app',
      tags: [
        {
          key: 'service.name',
          type: 'string',
          value: 'app',
        },
        {
          key: 'cluster',
          type: 'string',
          value: 'tns',
        },
        {
          key: 'namespace',
          type: 'string',
          value: 'tns',
        },
        {
          key: 'opencensus.exporterversion',
          type: 'string',
          value: 'Jaeger-Go-2.22.1',
        },
        {
          key: 'host.hostname',
          type: 'string',
          value: '9549a52e8f76',
        },
        {
          key: 'ip',
          type: 'string',
          value: '172.21.0.6',
        },
        {
          key: 'client-uuid',
          type: 'string',
          value: '20a8528f1d337232',
        },
      ],
    },
    db: {
      serviceName: 'db',
      tags: [
        {
          key: 'service.name',
          type: 'string',
          value: 'db',
        },
        {
          key: 'cluster',
          type: 'string',
          value: 'tns',
        },
        {
          key: 'namespace',
          type: 'string',
          value: 'tns',
        },
        {
          key: 'opencensus.exporterversion',
          type: 'string',
          value: 'Jaeger-Go-2.22.1',
        },
        {
          key: 'host.hostname',
          type: 'string',
          value: '86b3221ed80f',
        },
        {
          key: 'ip',
          type: 'string',
          value: '172.21.0.4',
        },
        {
          key: 'client-uuid',
          type: 'string',
          value: '177e9777791dfe05',
        },
      ],
    },
    lb: {
      serviceName: 'lb',
      tags: [
        {
          key: 'service.name',
          type: 'string',
          value: 'lb',
        },
        {
          key: 'cluster',
          type: 'string',
          value: 'tns',
        },
        {
          key: 'namespace',
          type: 'string',
          value: 'tns',
        },
        {
          key: 'opencensus.exporterversion',
          type: 'string',
          value: 'Jaeger-Go-2.22.1',
        },
        {
          key: 'host.hostname',
          type: 'string',
          value: '6f058f383a0c',
        },
        {
          key: 'ip',
          type: 'string',
          value: '172.21.0.2',
        },
        {
          key: 'client-uuid',
          type: 'string',
          value: '1b26be644b89525f',
        },
      ],
    },
  },
  spans: [
    {
      duration: 103198,
      flags: 1,
      logs: [],
      operationName: 'HTTP Client',
      processID: 'app',
      references: [
        {
          refType: 'CHILD_OF',
          spanID: 'Rk9sNlhOajJUWlU9',
          traceID: 'id',
        },
      ],
      spanID: 'Y1h1RllSZ2E1THM9',
      startTime: 1613672729934074,
      tags: [],
      traceID: 'id',
    },
    {
      duration: 98082,
      flags: 1,
      logs: [],
      operationName: 'HTTP GET - root',
      processID: 'db',
      references: [
        {
          refType: 'CHILD_OF',
          spanID: 'QUZxY01zU01aNW89',
          traceID: 'id',
        },
      ],
      spanID: 'Rm1BZEpMc0oxSUE9',
      startTime: 1613672729937973,
      tags: [
        {
          key: 'span.kind',
          type: 'string',
          value: 'server',
        },
        {
          key: 'status.code',
          type: 'int64',
          value: 2,
        },
        {
          key: 'error',
          type: 'bool',
          value: true,
        },
        {
          key: 'http.status_code',
          type: 'int64',
          value: 500,
        },
        {
          key: 'http.method',
          type: 'string',
          value: 'GET',
        },
        {
          key: 'http.url',
          type: 'string',
          value: '/',
        },
        {
          key: 'component',
          type: 'string',
          value: 'net/http',
        },
      ],
      traceID: 'id',
    },
    {
      duration: 112153,
      flags: 1,
      logs: [],
      operationName: 'HTTP Client',
      processID: 'lb',
      references: [],
      spanID: 'TzdId1dOZTBwY289',
      startTime: 1613672729926420,
      tags: [
        {
          key: 'sampler.type',
          type: 'string',
          value: 'const',
        },
        {
          key: 'sampler.param',
          type: 'bool',
          value: true,
        },
      ],
      traceID: 'id',
    },
    {
      duration: 103243,
      flags: 1,
      logs: [
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'GetConn',
            },
          ],
          timestamp: 1613672729934142,
        },
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'DNSStart',
            },
            {
              key: 'host',
              type: 'string',
              value: 'db',
            },
          ],
          timestamp: 1613672729934286,
        },
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'DNSDone',
            },
            {
              key: 'addr',
              type: 'string',
              value: '172.21.0.4',
            },
          ],
          timestamp: 1613672729936343,
        },
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'ConnectStart',
            },
            {
              key: 'network',
              type: 'string',
              value: 'tcp',
            },
            {
              key: 'addr',
              type: 'string',
              value: '172.21.0.4:80',
            },
          ],
          timestamp: 1613672729936399,
        },
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'ConnectDone',
            },
            {
              key: 'network',
              type: 'string',
              value: 'tcp',
            },
            {
              key: 'addr',
              type: 'string',
              value: '172.21.0.4:80',
            },
          ],
          timestamp: 1613672729937041,
        },
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'GotConn',
            },
          ],
          timestamp: 1613672729937123,
        },
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'WroteHeaders',
            },
          ],
          timestamp: 1613672729937473,
        },
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'WroteRequest',
            },
          ],
          timestamp: 1613672729937497,
        },
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'GotFirstResponseByte',
            },
          ],
          timestamp: 1613672730036696,
        },
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'ClosedBody',
            },
          ],
          timestamp: 1613672730037331,
        },
      ],
      operationName: 'HTTP GET',
      processID: 'app',
      references: [
        {
          refType: 'CHILD_OF',
          spanID: 'Y1h1RllSZ2E1THM9',
          traceID: 'id',
        },
      ],
      spanID: 'QUZxY01zU01aNW89',
      startTime: 1613672729934101,
      tags: [
        {
          key: 'span.kind',
          type: 'string',
          value: 'client',
        },
        {
          key: 'status.code',
          type: 'int64',
          value: 2,
        },
        {
          key: 'error',
          type: 'bool',
          value: true,
        },
        {
          key: 'http.status_code',
          type: 'int64',
          value: 500,
        },
        {
          key: 'component',
          type: 'string',
          value: 'net/http',
        },
        {
          key: 'http.method',
          type: 'string',
          value: 'GET',
        },
        {
          key: 'http.url',
          type: 'string',
          value: 'db:80',
        },
        {
          key: 'net/http.reused',
          type: 'bool',
          value: false,
        },
        {
          key: 'net/http.was_idle',
          type: 'bool',
          value: false,
        },
      ],
      traceID: 'id',
    },
    {
      duration: 112951,
      flags: 1,
      logs: [
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'GetConn',
            },
          ],
          timestamp: 1613672729926514,
        },
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'DNSStart',
            },
            {
              key: 'host',
              type: 'string',
              value: 'app',
            },
          ],
          timestamp: 1613672729926879,
        },
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'DNSDone',
            },
            {
              key: 'addr',
              type: 'string',
              value: '172.21.0.6',
            },
          ],
          timestamp: 1613672729930597,
        },
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'ConnectStart',
            },
            {
              key: 'network',
              type: 'string',
              value: 'tcp',
            },
            {
              key: 'addr',
              type: 'string',
              value: '172.21.0.6:80',
            },
          ],
          timestamp: 1613672729930651,
        },
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'ConnectDone',
            },
            {
              key: 'network',
              type: 'string',
              value: 'tcp',
            },
            {
              key: 'addr',
              type: 'string',
              value: '172.21.0.6:80',
            },
          ],
          timestamp: 1613672729931347,
        },
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'GotConn',
            },
          ],
          timestamp: 1613672729931736,
        },
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'WroteHeaders',
            },
          ],
          timestamp: 1613672729931906,
        },
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'WroteRequest',
            },
          ],
          timestamp: 1613672729931932,
        },
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'GotFirstResponseByte',
            },
          ],
          timestamp: 1613672730038167,
        },
        {
          fields: [
            {
              key: 'event',
              type: 'string',
              value: 'ClosedBody',
            },
          ],
          timestamp: 1613672730039395,
        },
      ],
      operationName: 'HTTP GET',
      processID: 'lb',
      references: [
        {
          refType: 'CHILD_OF',
          spanID: 'TzdId1dOZTBwY289',
          traceID: 'id',
        },
      ],
      spanID: 'VGF5NVN1MmprR1U9',
      startTime: 1613672729926451,
      tags: [
        {
          key: 'span.kind',
          type: 'string',
          value: 'client',
        },
        {
          key: 'status.code',
          type: 'int64',
          value: 2,
        },
        {
          key: 'error',
          type: 'bool',
          value: true,
        },
        {
          key: 'http.status_code',
          type: 'int64',
          value: 500,
        },
        {
          key: 'component',
          type: 'string',
          value: 'net/http',
        },
        {
          key: 'http.method',
          type: 'string',
          value: 'GET',
        },
        {
          key: 'http.url',
          type: 'string',
          value: 'app:80',
        },
        {
          key: 'net/http.reused',
          type: 'bool',
          value: false,
        },
        {
          key: 'net/http.was_idle',
          type: 'bool',
          value: false,
        },
      ],
      traceID: 'id',
    },
    {
      duration: 103759,
      flags: 1,
      logs: [],
      operationName: 'HTTP GET - root',
      processID: 'app',
      references: [
        {
          refType: 'CHILD_OF',
          spanID: 'VGF5NVN1MmprR1U9',
          traceID: 'id',
        },
      ],
      spanID: 'Rk9sNlhOajJUWlU9',
      startTime: 1613672729933861,
      tags: [
        {
          key: 'span.kind',
          type: 'string',
          value: 'server',
        },
        {
          key: 'status.code',
          type: 'int64',
          value: 2,
        },
        {
          key: 'error',
          type: 'bool',
          value: true,
        },
        {
          key: 'http.status_code',
          type: 'int64',
          value: 500,
        },
        {
          key: 'http.method',
          type: 'string',
          value: 'GET',
        },
        {
          key: 'http.url',
          type: 'string',
          value: '/',
        },
        {
          key: 'component',
          type: 'string',
          value: 'net/http',
        },
      ],
      traceID: 'id',
    },
  ],
  traceID: 'id',
  warnings: null,
};
