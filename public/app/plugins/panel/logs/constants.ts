import { ArrayVector } from '@grafana/data';

export const DEFAULT_TS = (ts: string) => ({
  name: 'ts',
  type: 'time',
  values: new ArrayVector([ts]),
  config: {
    displayName: 'Time',
  },
});

export const DEFAULT_LINE = (log: Record<string, any>) => ({
  name: 'line',
  type: 'string',
  values: new ArrayVector([log.msg]),
  labels: { ...log },
  config: {},
});

export const DEFAULT_ID = (id: number) => ({
  name: 'id',
  type: 'string',
  values: new ArrayVector([id]),
  config: {},
});

export const DEFAULT_TS_NS = (ts: number) => ({
  name: 'tsNs',
  type: 'time',
  values: new ArrayVector([ts]),
  config: {
    displayName: 'Time ns',
  },
});

export const DEFAULT_TRACEID = (traceId: string) => ({
  name: 'traceID',
  type: 'string',
  values: new ArrayVector([traceId]),
  config: {
    displayName: 'Trace ID',
    links: [
      {
        title: '',
        url: '',
        internal: {
          query: {
            query: '${__value.raw}',
          },
          datasourceUid: 'tempo',
          datasourceName: 'Tempo',
        },
      },
    ],
  },
});

export const DEFAULT_SPANID = (spanId: string) => ({
  name: 'spanID',
  type: 'string',
  values: new ArrayVector([spanId]),
  config: {
    displayName: 'Span ID',
  },
});
