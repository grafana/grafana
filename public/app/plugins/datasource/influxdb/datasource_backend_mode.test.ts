import { of } from 'rxjs';

import { DataQueryRequest, dateTime, ScopedVars } from '@grafana/data/src';
import { FetchResponse } from '@grafana/runtime/src';
import config from 'app/core/config';

import {
  getMockDSInstanceSettings,
  getMockInfluxDS,
  mockBackendService,
  mockInfluxFetchResponse,
  mockTemplateSrv,
} from './mocks';
import { InfluxQuery } from './types';

config.featureToggles.influxdbBackendMigration = true;
const fetchMock = mockBackendService(mockInfluxFetchResponse());

describe('InfluxDataSource Backend Mode', () => {
  const text = 'interpolationText';
  const text2 = 'interpolationText2';
  const textWithoutFormatRegex = 'interpolationText,interpolationText2';
  const textWithFormatRegex = 'interpolationText|interpolationText2';
  const variableMap: Record<string, string> = {
    $interpolationVar: text,
    $interpolationVar2: text2,
  };
  const adhocFilters = [
    {
      key: 'adhoc',
      operator: '=',
      value: 'val',
      condition: '',
    },
  ];
  const templateSrv = mockTemplateSrv(
    jest.fn(() => {
      return adhocFilters;
    }),
    jest.fn((target?: string, scopedVars?: ScopedVars, format?: string | Function): string => {
      if (!format) {
        return variableMap[target!] || '';
      }
      if (format === 'regex') {
        return textWithFormatRegex;
      }
      return textWithoutFormatRegex;
    })
  );

  let queryOptions: DataQueryRequest<InfluxQuery>;
  let influxQuery: InfluxQuery;
  const now = dateTime('2023-09-16T21:26:00Z');

  beforeEach(() => {
    queryOptions = {
      app: 'dashboard',
      interval: '10',
      intervalMs: 10,
      requestId: 'A-testing',
      startTime: 0,
      range: {
        from: dateTime(now).subtract(15, 'minutes'),
        to: now,
        raw: {
          from: 'now-15m',
          to: 'now',
        },
      },
      rangeRaw: {
        from: 'now-15m',
        to: 'now',
      },
      targets: [],
      timezone: 'UTC',
      scopedVars: {
        interval: { text: '1m', value: '1m' },
        __interval: { text: '1m', value: '1m' },
        __interval_ms: { text: 60000, value: 60000 },
      },
    };

    influxQuery = {
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
    };
  });

  describe('adhoc filters', () => {
    let fetchReq: { queries: InfluxQuery[] };
    const ctx = {
      ds: getMockInfluxDS(getMockDSInstanceSettings(), templateSrv),
    };
    beforeEach(async () => {
      fetchMock.mockImplementation((req) => {
        fetchReq = req.data;
        return of(mockInfluxFetchResponse() as FetchResponse);
      });
      const req = {
        ...queryOptions,
        targets: [...queryOptions.targets, { ...influxQuery, adhocFilters }],
      };
      await ctx.ds.query(req);
    });

    it('should add adhocFilters to the tags in the query', () => {
      expect(fetchMock).toHaveBeenCalled();
      expect(fetchReq).not.toBeNull();
      expect(fetchReq.queries.length).toBe(1);
      expect(fetchReq.queries[0].tags).toBeDefined();
      expect(fetchReq.queries[0].tags?.length).toBe(2);
      expect(fetchReq.queries[0].tags?.[1].key).toBe(adhocFilters[0].key);
      expect(fetchReq.queries[0].tags?.[1].value).toBe(adhocFilters[0].value);
    });
  });
});
