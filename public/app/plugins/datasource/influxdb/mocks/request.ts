import { type DataQueryRequest, dateTime } from '@grafana/data';
import { type SQLQuery } from '@grafana/sql';

import { type InfluxQuery } from '../types';

type QueryType = InfluxQuery & SQLQuery;

export const mockInfluxQueryRequest = (targets?: QueryType[]): DataQueryRequest<QueryType> => {
  return {
    app: 'explore',
    interval: '1m',
    intervalMs: 60000,
    range: {
      from: dateTime(0),
      to: dateTime(10),
      raw: { from: dateTime(0), to: dateTime(10) },
    },
    rangeRaw: {
      from: dateTime(0),
      to: dateTime(10),
    },
    filters: [{ key: 'adhoc_key', value: 'adhoc_val', operator: '=' }],
    requestId: '',
    scopedVars: {},
    startTime: 0,
    targets: targets ?? mockTargets(),
    timezone: '',
  };
};

const mockTargets = (): QueryType[] => {
  return [
    {
      refId: 'A',
      datasource: {
        type: 'influxdb',
        uid: 'vA4bkHenk',
      },
      policy: 'default',
      resultFormat: 'time_series',
      orderByTime: 'ASC',
      tags: [],
      groupBy: [
        {
          type: 'time',
          params: ['$__interval'],
        },
        {
          type: 'fill',
          params: ['null'],
        },
      ],
      select: [
        [
          {
            type: 'field',
            params: ['value'],
          },
          {
            type: 'mean',
            params: [],
          },
        ],
      ],
      measurement: 'cpu',
    },
  ];
};
