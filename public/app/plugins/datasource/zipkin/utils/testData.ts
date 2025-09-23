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

export const traceFrameFields = [
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
        { key: 'endpointType', value: 'local' },
      ],
      [
        { key: 'ipv4', value: '1.0.0.1' },
        { key: 'endpointType', value: 'local' },
      ],
      [
        { key: 'ipv6', value: '127.0.0.1' },
        { key: 'endpointType', value: 'remote' },
      ],
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
].map((f) => ({ ...f, values: f.values }));
