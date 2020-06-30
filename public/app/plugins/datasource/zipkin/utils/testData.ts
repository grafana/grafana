import { TraceSpanData, TraceData } from '@grafana/data';
import { ZipkinSpan } from '../types';

export const zipkinResponse: ZipkinSpan[] = [
  {
    traceId: 'trace_id',
    name: 'span 1',
    id: 'span 1 id',
    timestamp: 1,
    duration: 10,
    localEndpoint: {
      serviceName: 'service 1',
      ipv4: '1.0.0.1',
      port: 42,
    },
    annotations: [
      {
        timestamp: 2,
        value: 'annotation text',
      },
      {
        timestamp: 6,
        value: 'annotation text 3',
      },
    ],
    tags: {
      tag1: 'val1',
      tag2: 'val2',
    },
    kind: 'CLIENT',
  },

  {
    traceId: 'trace_id',
    parentId: 'span 1 id',
    name: 'span 2',
    id: 'span 2 id',
    timestamp: 4,
    duration: 5,
    localEndpoint: {
      serviceName: 'service 2',
      ipv4: '1.0.0.1',
    },
    tags: {
      error: '404',
    },
  },
  {
    traceId: 'trace_id',
    parentId: 'span 1 id',
    name: 'span 3',
    id: 'span 3 id',
    timestamp: 6,
    duration: 7,
    remoteEndpoint: {
      serviceName: 'spanstore-jdbc',
      ipv6: '127.0.0.1',
    },
  },
];

export const jaegerTrace: TraceData & { spans: TraceSpanData[] } = {
  processes: {
    'service 1': {
      serviceName: 'service 1',
      tags: [
        {
          key: 'ipv4',
          type: 'string',
          value: '1.0.0.1',
        },
        {
          key: 'port',
          type: 'number',
          value: 42,
        },
      ],
    },
    'service 2': {
      serviceName: 'service 2',
      tags: [
        {
          key: 'ipv4',
          type: 'string',
          value: '1.0.0.1',
        },
      ],
    },
    'spanstore-jdbc': {
      serviceName: 'spanstore-jdbc',
      tags: [
        {
          key: 'ipv6',
          type: 'string',
          value: '127.0.0.1',
        },
      ],
    },
  },
  traceID: 'trace_id',
  warnings: null,
  spans: [
    {
      duration: 10,
      flags: 1,
      logs: [
        {
          timestamp: 2,
          fields: [{ key: 'annotation', type: 'string', value: 'annotation text' }],
        },
        {
          timestamp: 6,
          fields: [{ key: 'annotation', type: 'string', value: 'annotation text 3' }],
        },
      ],
      operationName: 'span 1',
      processID: 'service 1',
      startTime: 1,
      spanID: 'span 1 id',
      traceID: 'trace_id',
      warnings: null as any,
      tags: [
        {
          key: 'kind',
          type: 'string',
          value: 'CLIENT',
        },
        {
          key: 'tag1',
          type: 'string',
          value: 'val1',
        },
        {
          key: 'tag2',
          type: 'string',
          value: 'val2',
        },
      ],
      references: [],
    },
    {
      duration: 5,
      flags: 1,
      logs: [],
      operationName: 'span 2',
      processID: 'service 2',
      startTime: 4,
      spanID: 'span 2 id',
      traceID: 'trace_id',
      warnings: null as any,
      tags: [
        {
          key: 'error',
          type: 'bool',
          value: true,
        },
      ],
      references: [
        {
          refType: 'CHILD_OF',
          spanID: 'span 1 id',
          traceID: 'trace_id',
        },
      ],
    },
    {
      duration: 7,
      flags: 1,
      logs: [],
      operationName: 'span 3',
      processID: 'spanstore-jdbc',
      startTime: 6,
      tags: [],
      spanID: 'span 3 id',
      traceID: 'trace_id',
      warnings: null as any,
      references: [
        {
          refType: 'CHILD_OF',
          spanID: 'span 1 id',
          traceID: 'trace_id',
        },
      ],
    },
  ],
};
