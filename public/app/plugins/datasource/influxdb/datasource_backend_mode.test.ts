import { of } from 'rxjs';

import { DataQueryRequest, dateTime, ScopedVars } from '@grafana/data/src';
import { FetchResponse } from '@grafana/runtime/src';
import config from 'app/core/config';

import { TemplateSrv } from '../../../features/templating/template_srv';
import { queryBuilder } from '../../../features/variables/shared/testing/builders';

import InfluxDatasource from './datasource';
import {
  getMockDSInstanceSettings,
  getMockInfluxDS,
  mockBackendService,
  mockInfluxFetchResponse,
  mockInfluxQueryWithTemplateVars,
  mockTemplateSrv,
} from './mocks';
import { InfluxQuery, InfluxVersion } from './types';

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
      ctx.ds.query(req);
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

  describe('when interpolating template variables', () => {
    const text = 'interpolationText';
    const text2 = 'interpolationText2';
    const textWithoutFormatRegex = 'interpolationText,interpolationText2';
    const textWithFormatRegex = 'interpolationText,interpolationText2';
    const justText = 'interpolationText';
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
      jest.fn((_: string) => adhocFilters),
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
    const ds = new InfluxDatasource(getMockDSInstanceSettings(), templateSrv);

    function influxChecks(query: InfluxQuery) {
      expect(templateSrv.replace).toBeCalledTimes(12);
      expect(query.alias).toBe(text);
      expect(query.measurement).toBe(justText);
      expect(query.policy).toBe(justText);
      expect(query.limit).toBe(justText);
      expect(query.slimit).toBe(justText);
      expect(query.tz).toBe(text);
      expect(query.tags![0].value).toBe(textWithFormatRegex);
      expect(query.groupBy![0].params![0]).toBe(justText);
      expect(query.select![0][0].params![0]).toBe(justText);
      expect(query.adhocFilters?.[0].key).toBe(adhocFilters[0].key);
    }

    it('should apply all template variables with InfluxQL mode', () => {
      ds.version = ds.version = InfluxVersion.InfluxQL;
      ds.access = 'proxy';
      const query = ds.applyTemplateVariables(mockInfluxQueryWithTemplateVars(adhocFilters), {
        interpolationVar: { text: text, value: text },
        interpolationVar2: { text: 'interpolationText2', value: 'interpolationText2' },
      });
      influxChecks(query);
    });

    it('should apply all scopedVars to tags', () => {
      ds.version = InfluxVersion.InfluxQL;
      ds.access = 'proxy';
      const query = ds.applyTemplateVariables(mockInfluxQueryWithTemplateVars(adhocFilters), {
        interpolationVar: { text: text, value: text },
        interpolationVar2: { text: 'interpolationText2', value: 'interpolationText2' },
      });
      if (!query.tags?.length) {
        throw new Error('Tags are not defined');
      }
      const value = query.tags[0].value;
      const scopedVars = 'interpolationText,interpolationText2';
      expect(value).toBe(scopedVars);
    });
  });

  describe('variable interpolation with chained variables with backend mode', () => {
    const variablesMock = [queryBuilder().withId('var1').withName('var1').withCurrent('var1').build()];
    const mockTemplateService = new TemplateSrv({
      getVariables: () => variablesMock,
      getVariableWithName: (name: string) => variablesMock.filter((v) => v.name === name)[0],
      getFilteredVariables: jest.fn(),
    });
    mockTemplateService.getAdhocFilters = jest.fn((_: string) => []);
    let ds = getMockInfluxDS(getMockDSInstanceSettings(), mockTemplateService);
    const fetchMockImpl = () =>
      of({
        data: {
          status: 'success',
          results: [
            {
              series: [
                {
                  name: 'measurement',
                  columns: ['name'],
                  values: [['cpu']],
                },
              ],
            },
          ],
        },
      });

    beforeEach(() => {
      jest.clearAllMocks();
      fetchMock.mockImplementation(fetchMockImpl);
    });

    it('should render chained regex variables with floating point number', () => {
      ds.metricFindQuery(`SELECT sum("piece_count") FROM "rp"."pdata" WHERE diameter <= $maxSED`, {
        ...queryOptions,
        scopedVars: { maxSED: { text: '8.1', value: '8.1' } },
      });
      const qe = `SELECT sum("piece_count") FROM "rp"."pdata" WHERE diameter <= 8.1`;
      const qData = fetchMock.mock.calls[0][0].data.queries[0].query;
      expect(qData).toBe(qe);
    });

    it('should render chained regex variables with URL', () => {
      ds.metricFindQuery('SHOW TAG VALUES WITH KEY = "agent_url" WHERE agent_url =~ /^$var1$/', {
        ...queryOptions,
        scopedVars: {
          var1: {
            text: 'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg',
            value: 'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg',
          },
        },
      });
      const qe = `SHOW TAG VALUES WITH KEY = "agent_url" WHERE agent_url =~ /^https:\\/\\/aaaa-aa-aaa\\.bbb\\.ccc\\.ddd:8443\\/ggggg$/`;
      expect(fetchMock).toHaveBeenCalled();
      const qData = fetchMock.mock.calls[0][0].data.queries[0].query;
      expect(qData).toBe(qe);
    });

    it('should render chained regex variables with floating point number and url', () => {
      ds.metricFindQuery(
        'SELECT sum("piece_count") FROM "rp"."pdata" WHERE diameter <= $maxSED AND agent_url =~ /^$var1$/',
        {
          ...queryOptions,
          scopedVars: {
            var1: {
              text: 'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg',
              value: 'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg',
            },
            maxSED: { text: '8.1', value: '8.1' },
          },
        }
      );
      const qe = `SELECT sum("piece_count") FROM "rp"."pdata" WHERE diameter <= 8.1 AND agent_url =~ /^https:\\/\\/aaaa-aa-aaa\\.bbb\\.ccc\\.ddd:8443\\/ggggg$/`;
      const qData = fetchMock.mock.calls[0][0].data.queries[0].query;
      expect(qData).toBe(qe);
    });

    it('should interpolate variable inside a regex pattern', () => {
      const query: InfluxQuery = {
        refId: 'A',
        tags: [
          {
            key: 'key',
            operator: '=~',
            value: '/^.*-$var1$/',
          },
        ],
      };
      const res = ds.applyVariables(query, {});
      const expected = `/^.*-var1$/`;
      expect(res.tags?.[0].value).toEqual(expected);
    });
  });

  describe('metric find query', () => {
    let ds = getMockInfluxDS(getMockDSInstanceSettings());
    it('handles multiple frames', async () => {
      const fetchMockImpl = () => {
        return of(mockMetricFindQueryResponse);
      };

      fetchMock.mockImplementation(fetchMockImpl);
      const values = await ds.getTagValues({ key: 'test_id', filters: [] });
      expect(fetchMock).toHaveBeenCalled();
      expect(values.length).toBe(5);
      expect(values[0].text).toBe('test-t2-1');
    });
  });
});

const mockMetricFindQueryResponse = {
  data: {
    results: {
      metricFindQuery: {
        status: 200,
        frames: [
          {
            schema: {
              name: 'NoneNone',
              refId: 'metricFindQuery',
              fields: [
                {
                  name: 'Value',
                  type: 'string',
                  typeInfo: {
                    frame: 'string',
                  },
                },
              ],
            },
            data: {
              values: [['test-t2-1', 'test-t2-10']],
            },
          },
          {
            schema: {
              name: 'some-other',
              refId: 'metricFindQuery',
              fields: [
                {
                  name: 'Value',
                  type: 'string',
                  typeInfo: {
                    frame: 'string',
                  },
                },
              ],
            },
            data: {
              values: [['test-t2-1', 'test-t2-10', 'test-t2-2', 'test-t2-3', 'test-t2-4']],
            },
          },
        ],
      },
    },
  },
};
