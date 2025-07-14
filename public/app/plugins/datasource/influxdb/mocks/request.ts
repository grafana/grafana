import { AdHocVariableFilter, DataQueryRequest, dateTime } from '@grafana/data';
import { SQLQuery } from '@grafana/sql';

import { InfluxQuery } from '../types';

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

export const mockTargets = (): QueryType[] => {
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

export const mockInfluxQueryWithTemplateVars = (adhocFilters: AdHocVariableFilter[]): InfluxQuery => ({
  refId: 'x',
  alias: '$var1',
  measurement: '$var1',
  policy: '$var1',
  limit: '$var1',
  slimit: '$var1',
  tz: '$var1',
  tags: [
    {
      key: 'drive',
      operator: '=~',
      value: '/^$path$/',
    },
  ],
  groupBy: [
    {
      params: ['$var1'],
      type: 'tag',
    },
  ],
  select: [
    [
      {
        params: ['$var1'],
        type: 'field',
      },
    ],
  ],
  adhocFilters,
});
