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
  alias: '$interpolationVar',
  measurement: '$interpolationVar',
  policy: '$interpolationVar',
  limit: '$interpolationVar',
  slimit: '$interpolationVar',
  tz: '$interpolationVar',
  tags: [
    {
      key: 'cpu',
      operator: '=~',
      value: '/^$interpolationVar,$interpolationVar2$/',
    },
  ],
  groupBy: [
    {
      params: ['$interpolationVar'],
      type: 'tag',
    },
  ],
  select: [
    [
      {
        params: ['$interpolationVar'],
        type: 'field',
      },
    ],
  ],
  adhocFilters,
});
