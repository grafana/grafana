import { of } from 'rxjs';

import {
  DataQueryRequest,
  DataSourceInstanceSettings,
  dateTime,
  ScopedVars,
  TypedVariableModel,
} from '@grafana/data/src';
import { FetchResponse, setDataSourceSrv } from '@grafana/runtime/src';
import config from 'app/core/config';

import { convertToStoreState } from '../../../../test/helpers/convertToStoreState';
import { getTemplateSrvDependencies } from '../../../../test/helpers/getTemplateSrvDependencies';
import { TemplateSrv } from '../../../features/templating/template_srv';

import InfluxDatasource from './datasource';
import {
  getMockDSInstanceSettings,
  getMockInfluxDS,
  mockBackendService,
  mockInfluxFetchResponse,
  mockInfluxQueryWithTemplateVars,
  mockTemplateSrv,
} from './mocks';
import { InfluxOptions, InfluxQuery, InfluxVersion } from './types';

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

  // @todo revisit these tests
  describe('when interpolating template variables', () => {
    const text = 'interpolationText';
    const text2 = 'interpolationText2';
    const textWithoutFormatRegex = 'interpolationText,interpolationText2';
    const textWithFormatRegex = 'interpolationText,interpolationText2';
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
      expect(query.measurement).toBe(textWithFormatRegex);
      expect(query.policy).toBe(textWithFormatRegex);
      expect(query.limit).toBe(textWithFormatRegex);
      expect(query.slimit).toBe(textWithFormatRegex);
      expect(query.tz).toBe(text);
      expect(query.tags![0].value).toBe(textWithFormatRegex);
      expect(query.groupBy![0].params![0]).toBe(textWithFormatRegex);
      expect(query.select![0][0].params![0]).toBe(textWithFormatRegex);
      expect(query.adhocFilters?.[0].key).toBe(adhocFilters[0].key);
    }

    // @todo what is this testing and why is it passing?
    it('should apply all template variables with InfluxQL mode', () => {
      ds.version = ds.version = InfluxVersion.InfluxQL;
      ds.access = 'proxy';
      const query = ds.applyTemplateVariables(mockInfluxQueryWithTemplateVars(adhocFilters), {
        interpolationVars: { text: 'you', value: 'shall' },
        interpolationVar2: { text: 'not', value: 'pass?' },
      });
      influxChecks(query);
    });

    // @todo fix, the TemplateSrv being called is not the one we are mocking
    it('should apply all scopedVars to tags', () => {
      ds.version = InfluxVersion.InfluxQL;
      ds.access = 'proxy';

      const query = ds.applyTemplateVariables(mockInfluxQueryWithTemplateVars(adhocFilters), {
        nothing: { text: 'you', value: 'shall' },
        doing: { text: 'not', value: 'pass' },
      });
      if (!query.tags?.length) {
        throw new Error('Tags are not defined');
      }
      const value = query.tags[0].value;
      const scopedVars = 'interpolationText,interpolationText2';
      expect(value).toBe(scopedVars);
    });
  });

  describe('variable interpolation with chained multi variables with backend mode', () => {
    let mockTemplateService = new TemplateSrv();
    let datasourceSettings = getMockDSInstanceSettings();
    const variables = [
      {
        type: 'query',
        name: 'var1',
        multi: true,
      },
    ] as TypedVariableModel[];
    const state = convertToStoreState('var1', variables);

    setDataSourceSrv({
      ...getTemplateSrvDependencies(state),
      getInstanceSettings: () => datasourceSettings,
      getList: () => [datasourceSettings],
      get: () => Promise.resolve(ds),
      reload: () => {},
    });
    mockTemplateService.init(variables);

    mockTemplateService.getAdhocFilters = jest.fn((_: string) => []);
    let ds = getMockInfluxDS(getMockDSInstanceSettings(), mockTemplateService);
    ds.version = InfluxVersion.InfluxQL;
    ds.access = 'proxy';
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

    it('should render variables with URL', () => {
      ds.metricFindQuery('SELECT "used_percent" FROM "disk" WHERE ("path"::tag =~ /^$var1$/) AND $timeFilter', {
        ...queryOptions,
        scopedVars: {
          var1: {
            text: 'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg',
            value: 'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg',
          },
        },
      });

      // This is what is returned on the frontend, but this test has the values escaped
      // Scoped var is probably not marked as multi
      const qe =
        'SELECT "used_percent" FROM "disk" WHERE ("path"::tag =~ /^https:\\/\\/aaaa-aa-aaa\\.bbb\\.ccc\\.ddd:8443\\/ggggg$/) AND $timeFilter';

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
  });

  describe('variable interpolation with single variables with backend mode', () => {
    let mockTemplateService = new TemplateSrv();
    let datasourceSettings = getMockDSInstanceSettings();
    const variables = [
      {
        type: 'query',
        name: 'var1',
        multi: false,
      },
    ] as TypedVariableModel[];
    const state = convertToStoreState('var1', variables);
    setDataSourceSrv({
      ...getTemplateSrvDependencies(state),
      getInstanceSettings: () => datasourceSettings,
      getList: () => [datasourceSettings],
      get: () => Promise.resolve(ds),
      reload: () => {},
    });
    mockTemplateService.init(variables);

    let ds = getMockInfluxDS(getMockDSInstanceSettings(), mockTemplateService);
    ds.version = InfluxVersion.InfluxQL;
    ds.access = 'proxy';
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

    it('should render variables with floating point number', () => {
      ds.metricFindQuery(`SELECT sum("piece_count") FROM "rp"."pdata" WHERE diameter <= $maxSED`, {
        ...queryOptions,
        scopedVars: { maxSED: { text: '8.1', value: '8.1' } },
      });
      const qe = `SELECT sum("piece_count") FROM "rp"."pdata" WHERE diameter <= 8.1`;
      const qData = fetchMock.mock.calls[0][0].data.queries[0].query;
      expect(qData).toBe(qe);
    });

    // in #80003 it was reported that non-regex values were also being escaped improperly as of 10.2.2
    it('should render variables with URL (single quote)', () => {
      ds.metricFindQuery('SHOW TAG VALUES WITH KEY = "agent_url" WHERE agent_url = \'$var1\'', {
        ...queryOptions,
        scopedVars: {
          var1: {
            text: 'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg',
            value: 'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg',
          },
        },
      });
      // this is the desired result AFAIK?
      const qe = `SHOW TAG VALUES WITH KEY = "agent_url" WHERE agent_url = 'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg'`;

      // And this is what we're currently returning
      // const qe = `SHOW TAG VALUES WITH KEY = "agent_url" WHERE agent_url = 'https:\\/\\/aaaa-aa-aaa\\.bbb\\.ccc\\.ddd:8443\\/ggggg'`;

      const qData = fetchMock.mock.calls[0][0].data.queries[0].query;
      expect(qData).toBe(qe);
    });

    it('should render variables with URL (2)', () => {
      ds.metricFindQuery('SELECT "used_percent" FROM "disk" WHERE ("path"::tag = \'$var1\') AND $timeFilter', {
        ...queryOptions,
        scopedVars: {
          var1: {
            text: 'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg',
            value: 'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg',
          },
        },
      });

      // This is what is returned on the frontend, but this test has the values escaped
      // Scoped var is probably not marked as multi
      const qe =
        'SELECT "used_percent" FROM "disk" WHERE ("path"::tag = \'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg\') AND $timeFilter';

      const qData = fetchMock.mock.calls[0][0].data.queries[0].query;
      expect(qData).toBe(qe);
    });

    // Users posted a workaround which is to denote the variable as raw, which will prevent escaping that breaks single quoted values
    it('should render single variables with URL (workaround)', () => {
      ds.metricFindQuery('SHOW TAG VALUES WITH KEY = "agent_url" WHERE agent_url = "${var1:raw}"', {
        ...queryOptions,
        scopedVars: {
          var1: {
            text: 'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg',
            value: 'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg',
          },
        },
      });
      const qe = `SHOW TAG VALUES WITH KEY = "agent_url" WHERE agent_url = "https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg"`;
      const qData = fetchMock.mock.calls[0][0].data.queries[0].query;
      expect(qData).toBe(qe);
    });

    it('should render single variables ', () => {
      ds.metricFindQuery('SHOW TAG VALUES WITH KEY = "agent_url" WHERE agent_url = \'$var1\'', {
        ...queryOptions,
        scopedVars: {
          var1: {
            text: 'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg',
            value: 'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg',
          },
        },
      });
      const qe = `SHOW TAG VALUES WITH KEY = "agent_url" WHERE agent_url = 'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg'`;
      const qData = fetchMock.mock.calls[0][0].data.queries[0].query;
      expect(qData).toBe(qe);
    });

    it('should render chained variables with floating point number and url', () => {
      ds.metricFindQuery(
        'SELECT sum("piece_count") FROM "rp"."pdata" WHERE diameter <= $maxSED AND agent_url = \'$var1\'',
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
      const qe = `SELECT sum("piece_count") FROM "rp"."pdata" WHERE diameter <= 8.1 AND agent_url = 'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg'`;
      const qData = fetchMock.mock.calls[0][0].data.queries[0].query;
      expect(qData).toBe(qe);
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

describe('applyVariables', () => {
  let mockTemplateService, datasourceSettings: DataSourceInstanceSettings<InfluxOptions>, ds: InfluxDatasource;
  beforeEach(() => {
    config.featureToggles.influxdbBackendMigration = true;
    mockTemplateService = new TemplateSrv();
    datasourceSettings = getMockDSInstanceSettings();
    ds = new InfluxDatasource(getMockDSInstanceSettings(), mockTemplateService);

    ds.version = InfluxVersion.InfluxQL;
    ds.access = 'proxy';

    const state = convertToStoreState('var1', [
      {
        type: 'query',
        name: 'var1',
        multi: true,
        current: { value: ['value1', 'value2'] },
        options: [{ value: 'value1' }, { value: 'value2' }],
      },
    ] as TypedVariableModel[]);

    setDataSourceSrv({
      ...getTemplateSrvDependencies(state),
      getInstanceSettings: () => datasourceSettings,
      getList: () => [datasourceSettings],
      get: () => Promise.resolve(ds),
      reload: () => {},
    });
  });

  it('Should interpolate and escape dots and slashes', () => {
    const query: InfluxQuery = ds.applyTemplateVariables(
      {
        ...mockInfluxQueryWithTemplateVars([]),
        tags: [
          {
            condition: 'AND',
            key: 'path::tag',
            operator: '=~',
            value: '/^$path$/',
          },
        ],
      },
      {
        path: {
          text: '/etc/resolv.conf',
          value: '/etc/resolv.conf',
        },
      }
    );
    if (!query.tags) {
      throw new Error('Tags are not defined');
    }
    expect(query.tags[0].value).toBe('/^\\\\/etc\\\\/resolv\\.conf$/');
  });
  it('Should interpolate and escape dots and slashes, not dash', () => {
    const query: InfluxQuery = ds.applyTemplateVariables(
      {
        ...mockInfluxQueryWithTemplateVars([]),
        tags: [
          {
            condition: 'AND',
            key: 'path::tag',
            operator: '=~',
            value: '/^$path$/',
          },
        ],
      },
      {
        path: {
          text: 'script/acme.sh:latest-amd64',
          value: 'script/acme.sh:latest-amd64',
        },
      }
    );
    if (!query.tags) {
      throw new Error('Tags are not defined');
    }
    expect(query.tags[0].value).toBe('/^script\\\\/acme\\.sh:latest-amd64$/');
  });
  it('Should escape single variable', () => {
    const query: InfluxQuery = ds.applyTemplateVariables(
      {
        ...mockInfluxQueryWithTemplateVars([]),
        tags: [
          {
            key: 'path::tag',
            operator: '=~',
            value: `/^$path$/`,
          },
        ],
      },
      {
        path: {
          text: '/var/log/host/system.log',
          value: '/var/log/host/system.log',
        },
      }
    );
    if (!query.tags) {
      throw new Error('Tags are not defined');
    }
    // This seems off, but it's working in influx
    expect(query.tags[0].value).toBe(`/^\\\\/var\\\\/log\\\\/host\\\\/system\\.log$/`);
  });
  it('Should remove extra escape chars for hardcoded variable value', () => {
    const query: InfluxQuery = ds.applyTemplateVariables(
      {
        ...mockInfluxQueryWithTemplateVars([]),
        tags: [
          {
            key: 'cpu',
            operator: '=~',
            value: `/^$var$/`,
          },
        ],
      },
      {
        var: {
          text: 'value (1)',
          value: 'value (1)',
        },
      }
    );
    if (!query.tags) {
      throw new Error('Tags are not defined');
    }
    expect(query.tags[0].value).toBe(`/^value \\(1\\)$/`);
  });
  it('should not escape anything in string', () => {
    const query: InfluxQuery = ds.applyTemplateVariables(
      {
        ...mockInfluxQueryWithTemplateVars([]),
        tags: [
          {
            key: 'var',
            operator: '=',
            value: '$var',
          },
        ],
      },
      {
        var: {
          text: '/var/log/host/system.log',
          value: '/var/log/host/system.log',
        },
      }
    );
    if (!query.tags) {
      throw new Error('Tags are not defined');
    }
    expect(query.tags[0].value).toBe('/var/log/host/system.log');
  });
});
