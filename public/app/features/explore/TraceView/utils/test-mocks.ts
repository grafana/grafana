import { MutableDataFrame } from '@grafana/data';

import { TraceData, TraceSpanData } from '../components/types/trace';

const response: TraceData & { spans: TraceSpanData[] } = {
  traceID: '1ed38015486087ca',
  spans: [
    {
      traceID: '1ed38015486087ca',
      spanID: '1ed38015486087ca',
      flags: 1,
      operationName: 'HTTP POST - api_prom_push',
      references: [],
      startTime: 1585244579835187,
      duration: 1098,
      tags: [
        { key: 'sampler.type', type: 'string', value: 'const' },
        { key: 'sampler.param', type: 'bool', value: true },
        { key: 'span.kind', type: 'string', value: 'server' },
        { key: 'http.method', type: 'string', value: 'POST' },
        { key: 'http.url', type: 'string', value: '/api/prom/push' },
        { key: 'component', type: 'string', value: 'net/http' },
        { key: 'http.status_code', type: 'int64', value: 204 },
        { key: 'internal.span.format', type: 'string', value: 'proto' },
      ],
      logs: [
        {
          timestamp: 1585244579835229,
          fields: [{ key: 'event', type: 'string', value: 'util.ParseProtoRequest[start reading]' }],
        },
        {
          timestamp: 1585244579835241,
          fields: [
            { key: 'event', type: 'string', value: 'util.ParseProtoRequest[decompress]' },
            { key: 'size', type: 'int64', value: 315 },
          ],
        },
        {
          timestamp: 1585244579835245,
          fields: [
            { key: 'event', type: 'string', value: 'util.ParseProtoRequest[unmarshal]' },
            { key: 'size', type: 'int64', value: 446 },
          ],
        },
      ],
      processID: '1ed38015486087ca',
      warnings: null,
    },
    {
      traceID: '1ed38015486087ca',
      spanID: '3fb050342773d333',
      flags: 1,
      operationName: '/logproto.Pusher/Push',
      references: [{ refType: 'CHILD_OF', traceID: '1ed38015486087ca', spanID: '1ed38015486087ca' }],
      startTime: 1585244579835341,
      duration: 921,
      tags: [
        { key: 'span.kind', type: 'string', value: 'client' },
        { key: 'component', type: 'string', value: 'gRPC' },
        { key: 'internal.span.format', type: 'string', value: 'proto' },
      ],
      logs: [],
      processID: '3fb050342773d333',
      warnings: null,
    },
    {
      traceID: '1ed38015486087ca',
      spanID: '35118c298fc91f68',
      flags: 1,
      operationName: '/logproto.Pusher/Push',
      references: [{ refType: 'CHILD_OF', traceID: '1ed38015486087ca', spanID: '3fb050342773d333' }],
      startTime: 1585244579836040,
      duration: 36,
      tags: [
        { key: 'span.kind', type: 'string', value: 'server' },
        { key: 'component', type: 'string', value: 'gRPC' },
        { key: 'internal.span.format', type: 'string', value: 'proto' },
      ],
      logs: [],
      processID: '35118c298fc91f68',
      warnings: null,
    },
  ],
  processes: {
    '1ed38015486087ca': {
      serviceName: 'loki-all',
      tags: [
        { key: 'client-uuid', type: 'string', value: 'client-uuid-1' },
        { key: 'hostname', type: 'string', value: '0080b530fae3' },
        { key: 'ip', type: 'string', value: '172.18.0.6' },
        { key: 'jaeger.version', type: 'string', value: 'Go-2.20.1' },
      ],
    },
    '3fb050342773d333': {
      serviceName: 'loki-all',
      tags: [
        { key: 'client-uuid', type: 'string', value: 'client-uuid-2' },
        { key: 'hostname', type: 'string', value: '0080b530fae3' },
        { key: 'ip', type: 'string', value: '172.18.0.6' },
        { key: 'jaeger.version', type: 'string', value: 'Go-2.20.1' },
      ],
    },
    '35118c298fc91f68': {
      serviceName: 'loki-all',
      tags: [
        { key: 'client-uuid', type: 'string', value: 'client-uuid-3' },
        { key: 'hostname', type: 'string', value: '0080b530fae3' },
        { key: 'ip', type: 'string', value: '172.18.0.6' },
        { key: 'jaeger.version', type: 'string', value: 'Go-2.20.1' },
      ],
    },
  },
  warnings: null,
};

export const frameOld = new MutableDataFrame({
  fields: [
    {
      name: 'trace',
      values: [response],
    },
  ],
  meta: {
    preferredVisualisationType: 'trace',
  },
});

export const frameNew = new MutableDataFrame({
  fields: [
    { name: 'traceID', values: ['1ed38015486087ca', '1ed38015486087ca', '1ed38015486087ca'] },
    { name: 'spanID', values: ['1ed38015486087ca', '3fb050342773d333', '35118c298fc91f68'] },
    { name: 'parentSpanID', values: [undefined, '1ed38015486087ca', '3fb050342773d333'] },
    { name: 'operationName', values: ['HTTP POST - api_prom_push', '/logproto.Pusher/Push', '/logproto.Pusher/Push'] },
    { name: 'serviceName', values: ['loki-all', 'loki-all', 'loki-all'] },
    {
      name: 'serviceTags',
      values: [
        [
          { key: 'client-uuid', value: '2a59d08899ef6a8a' },
          { key: 'hostname', value: '0080b530fae3' },
          { key: 'ip', value: '172.18.0.6' },
          { key: 'jaeger.version', value: 'Go-2.20.1' },
        ],
        [
          { key: 'client-uuid', value: '2a59d08899ef6a8a' },
          { key: 'hostname', value: '0080b530fae3' },
          { key: 'ip', value: '172.18.0.6' },
          { key: 'jaeger.version', value: 'Go-2.20.1' },
        ],
        [
          { key: 'client-uuid', value: '2a59d08899ef6a8a' },
          { key: 'hostname', value: '0080b530fae3' },
          { key: 'ip', value: '172.18.0.6' },
          { key: 'jaeger.version', value: 'Go-2.20.1' },
        ],
      ],
    },
    { name: 'startTime', values: [1585244579835.187, 1585244579835.341, 1585244579836.04] },
    { name: 'duration', values: [1.098, 0.921, 0.036] },
    {
      name: 'logs',
      values: [
        [
          {
            timestamp: 1585244579835.229,
            fields: [{ key: 'event', value: 'util.ParseProtoRequest[start reading]' }],
          },
          {
            timestamp: 1585244579835.241,
            fields: [
              { key: 'event', value: 'util.ParseProtoRequest[decompress]' },
              { key: 'size', value: 315 },
            ],
          },
          {
            timestamp: 1585244579835.245,
            fields: [
              { key: 'event', value: 'util.ParseProtoRequest[unmarshal]' },
              { key: 'size', value: 446 },
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
          { key: 'sampler.type', value: 'const' },
          { key: 'sampler.param', value: true },
          { key: 'span.kind', value: 'server' },
          { key: 'http.method', value: 'POST' },
          { key: 'http.url', value: '/api/prom/push' },
          { key: 'component', value: 'net/http' },
          { key: 'http.status_code', value: 204 },
          { key: 'internal.span.format', value: 'proto' },
        ],
        [
          { key: 'span.kind', value: 'client' },
          { key: 'component', value: 'gRPC' },
          { key: 'internal.span.format', value: 'proto' },
        ],
        [
          { key: 'span.kind', value: 'server' },
          { key: 'component', value: 'gRPC' },
          { key: 'internal.span.format', value: 'proto' },
        ],
      ],
    },
    { name: 'warnings', values: [undefined, undefined] },
    { name: 'stackTraces', values: [undefined, undefined] },
  ],
  meta: {
    preferredVisualisationType: 'trace',
  },
});
