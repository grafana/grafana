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
