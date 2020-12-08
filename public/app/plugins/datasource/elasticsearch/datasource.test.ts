import { first } from 'rxjs/operators';
import {
  ArrayVector,
  CoreApp,
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  dateMath,
  DateTime,
  dateTime,
  Field,
  FieldCache,
  MetricFindValue,
  MutableDataFrame,
  TimeRange,
  TimeSeries,
  toUtc,
} from '@grafana/data';
import _ from 'lodash';
import { ElasticDatasource, enhanceDataFrame } from './datasource';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { ElasticsearchOptions, ElasticsearchQuery, ElasticsearchQueryType } from './types';
import { Filters } from './components/QueryEditor/BucketAggregationsEditor/aggregations';

const ELASTICSEARCH_MOCK_URL = 'http://elasticsearch.local';

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => backendSrv,
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: () => {
        return { name: 'elastic25' };
      },
    };
  },
}));

const createTimeRange = (from: DateTime, to: DateTime): TimeRange => ({
  from,
  to,
  raw: {
    from,
    to,
  },
});

describe('ElasticDatasource', function(this: any) {
  const datasourceRequestMock = jest.spyOn(backendSrv, 'datasourceRequest');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const templateSrv: any = {
    replace: jest.fn(text => {
      if (text.startsWith('$')) {
        return `resolvedVariable`;
      } else {
        return text;
      }
    }),
    getAdhocFilters: jest.fn(() => []),
  };

  const timeSrv: any = createTimeSrv('now-1h');

  interface TestContext {
    ds: ElasticDatasource;
  }
  const ctx = {} as TestContext;

  function createTimeSrv(from: string) {
    const srv: any = {
      time: { from: from, to: 'now' },
    };

    srv.timeRange = jest.fn(() => {
      return {
        from: dateMath.parse(srv.time.from, false),
        to: dateMath.parse(srv.time.to, true),
      };
    });

    srv.setTime = jest.fn(time => {
      srv.time = time;
    });

    return srv;
  }

  function createDatasource(instanceSettings: DataSourceInstanceSettings<ElasticsearchOptions>) {
    createDatasourceWithTime(instanceSettings, timeSrv as TimeSrv);
  }

  function createDatasourceWithTime(
    instanceSettings: DataSourceInstanceSettings<ElasticsearchOptions>,
    timeSrv: TimeSrv
  ) {
    instanceSettings.jsonData = instanceSettings.jsonData || ({} as ElasticsearchOptions);
    ctx.ds = new ElasticDatasource(instanceSettings, templateSrv as TemplateSrv, timeSrv);
  }

  describe('When testing datasource with index pattern', () => {
    beforeEach(() => {
      createDatasource({
        url: ELASTICSEARCH_MOCK_URL,
        database: '[asd-]YYYY.MM.DD',
        jsonData: { interval: 'Daily', esVersion: 2 } as ElasticsearchOptions,
      } as DataSourceInstanceSettings<ElasticsearchOptions>);
    });

    it('should translate index pattern to current day', () => {
      let requestOptions: any;
      datasourceRequestMock.mockImplementation(options => {
        requestOptions = options;
        return Promise.resolve({ data: {} });
      });

      ctx.ds.testDatasource();

      const today = toUtc().format('YYYY.MM.DD');
      expect(requestOptions.url).toBe(`${ELASTICSEARCH_MOCK_URL}/asd-${today}/_mapping`);
    });
  });

  describe('When issuing metric query with interval pattern', () => {
    let requestOptions: any, parts: any, header: any, query: any, result: any;

    beforeEach(async () => {
      createDatasource({
        url: ELASTICSEARCH_MOCK_URL,
        database: '[asd-]YYYY.MM.DD',
        jsonData: { interval: 'Daily', esVersion: 2 } as ElasticsearchOptions,
      } as DataSourceInstanceSettings<ElasticsearchOptions>);

      datasourceRequestMock.mockImplementation(options => {
        requestOptions = options;
        return Promise.resolve({
          data: {
            responses: [
              {
                aggregations: {
                  '1': {
                    buckets: [
                      {
                        doc_count: 10,
                        key: 1000,
                      },
                    ],
                  },
                },
              },
            ],
          },
        });
      });

      query = {
        range: {
          from: toUtc([2015, 4, 30, 10]),
          to: toUtc([2015, 5, 1, 10]),
        },
        targets: [
          {
            alias: '$varAlias',
            bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '1' }],
            metrics: [{ type: 'count', id: '1' }],
            query: 'escape\\:test',
          },
        ],
      };

      result = await ctx.ds
        .query(query)
        .pipe(first())
        .toPromise();

      parts = requestOptions.data.split('\n');
      header = JSON.parse(parts[0]);
    });

    it('should translate index pattern to current day', () => {
      expect(header.index).toEqual(['asd-2015.05.30', 'asd-2015.05.31', 'asd-2015.06.01']);
    });

    it('should not resolve the variable in the original alias field in the query', () => {
      expect(query.targets[0].alias).toEqual('$varAlias');
    });

    it('should resolve the alias variable for the alias/target in the result', () => {
      expect(result.data[0].target).toEqual('resolvedVariable');
    });

    it('should json escape lucene query', () => {
      const body = JSON.parse(parts[1]);
      expect(body.query.bool.filter[1].query_string.query).toBe('escape\\:test');
    });
  });

  describe('When issuing logs query with interval pattern', () => {
    async function setupDataSource(jsonData?: Partial<ElasticsearchOptions>) {
      createDatasource({
        url: ELASTICSEARCH_MOCK_URL,
        database: 'mock-index',
        jsonData: {
          interval: 'Daily',
          esVersion: 2,
          timeField: '@timestamp',
          ...(jsonData || {}),
        } as ElasticsearchOptions,
      } as DataSourceInstanceSettings<ElasticsearchOptions>);

      datasourceRequestMock.mockImplementation(options => {
        return Promise.resolve(logsResponse);
      });

      const query: DataQueryRequest<ElasticsearchQuery> = {
        range: createTimeRange(toUtc([2015, 4, 30, 10]), toUtc([2019, 7, 1, 10])),
        targets: [
          {
            alias: '$varAlias',
            refId: 'A',
            bucketAggs: [{ type: 'date_histogram', settings: { interval: 'auto' }, id: '2' }],
            metrics: [{ type: 'count', id: '1' }],
            query: 'escape\\:test',
            isLogsQuery: true,
            timeField: '@timestamp',
          },
        ],
      } as DataQueryRequest<ElasticsearchQuery>;

      const queryBuilderSpy = jest.spyOn(ctx.ds.queryBuilder, 'getLogsQuery');
      const response = await ctx.ds
        .query(query)
        .pipe(first())
        .toPromise();
      return { queryBuilderSpy, response };
    }

    it('should call getLogsQuery()', async () => {
      const { queryBuilderSpy } = await setupDataSource();
      expect(queryBuilderSpy).toHaveBeenCalled();
    });

    it('should enhance fields with links', async () => {
      const { response } = await setupDataSource({
        dataLinks: [
          {
            field: 'host',
            url: 'http://localhost:3000/${__value.raw}',
          },
        ],
      });

      expect(response.data.length).toBe(1);
      const links = response.data[0].fields.find((field: Field) => field.name === 'host').config.links;
      expect(links.length).toBe(1);
      expect(links[0].url).toBe('http://localhost:3000/${__value.raw}');
    });
  });

  describe('When issuing document query', () => {
    let requestOptions: any, parts: any, header: any;

    beforeEach(() => {
      createDatasource({
        url: ELASTICSEARCH_MOCK_URL,
        database: 'test',
        jsonData: { esVersion: 2 } as ElasticsearchOptions,
      } as DataSourceInstanceSettings<ElasticsearchOptions>);

      datasourceRequestMock.mockImplementation(options => {
        requestOptions = options;
        return Promise.resolve({ data: { responses: [] } });
      });

      const query: DataQueryRequest<ElasticsearchQuery> = {
        range: createTimeRange(dateTime([2015, 4, 30, 10]), dateTime([2015, 5, 1, 10])),
        targets: [
          {
            refId: 'A',
            metrics: [{ type: 'raw_document', id: '1' }],
            query: 'test',
          },
        ],
      } as DataQueryRequest<ElasticsearchQuery>;

      ctx.ds.query(query);

      parts = requestOptions.data.split('\n');
      header = JSON.parse(parts[0]);
    });

    it('should set search type to query_then_fetch', () => {
      expect(header.search_type).toEqual('query_then_fetch');
    });

    it('should set size', () => {
      const body = JSON.parse(parts[1]);
      expect(body.size).toBe(500);
    });
  });

  describe('When getting an error on response', () => {
    const query: DataQueryRequest<ElasticsearchQuery> = {
      range: createTimeRange(toUtc([2020, 1, 1, 10]), toUtc([2020, 2, 1, 10])),
      targets: [
        {
          refId: 'A',
          alias: '$varAlias',
          bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '1' }],
          metrics: [{ type: 'count', id: '1' }],
          query: 'escape\\:test',
        },
      ],
    } as DataQueryRequest<ElasticsearchQuery>;

    createDatasource({
      url: ELASTICSEARCH_MOCK_URL,
      database: '[asd-]YYYY.MM.DD',
      jsonData: { interval: 'Daily', esVersion: 7 } as ElasticsearchOptions,
    } as DataSourceInstanceSettings<ElasticsearchOptions>);

    it('should process it properly', async () => {
      datasourceRequestMock.mockImplementation(() => {
        return Promise.resolve({
          data: {
            took: 1,
            responses: [
              {
                error: {
                  reason: 'all shards failed',
                },
                status: 400,
              },
            ],
          },
        });
      });

      const errObject = {
        data: '{\n    "reason": "all shards failed"\n}',
        message: 'all shards failed',
      };

      try {
        await ctx.ds.query(query);
      } catch (err) {
        expect(err).toEqual(errObject);
      }
    });

    it('should properly throw an unknown error', async () => {
      datasourceRequestMock.mockImplementation(() => {
        return Promise.resolve({
          data: {
            took: 1,
            responses: [
              {
                error: {},
                status: 400,
              },
            ],
          },
        });
      });

      const errObject = {
        data: '{}',
        message: 'Unknown elastic error response',
      };

      try {
        await ctx.ds.query(query);
      } catch (err) {
        expect(err).toEqual(errObject);
      }
    });
  });

  describe('When getting fields', () => {
    beforeEach(() => {
      createDatasource({
        url: ELASTICSEARCH_MOCK_URL,
        database: 'metricbeat',
        jsonData: { esVersion: 50 } as ElasticsearchOptions,
      } as DataSourceInstanceSettings<ElasticsearchOptions>);

      datasourceRequestMock.mockImplementation(options => {
        return Promise.resolve({
          data: {
            metricbeat: {
              mappings: {
                metricsets: {
                  _all: {},
                  _meta: {
                    test: 'something',
                  },
                  properties: {
                    '@timestamp': { type: 'date' },
                    __timestamp: { type: 'date' },
                    '@timestampnano': { type: 'date_nanos' },
                    beat: {
                      properties: {
                        name: {
                          fields: { raw: { type: 'keyword' } },
                          type: 'string',
                        },
                        hostname: { type: 'string' },
                      },
                    },
                    system: {
                      properties: {
                        cpu: {
                          properties: {
                            system: { type: 'float' },
                            user: { type: 'float' },
                          },
                        },
                        process: {
                          properties: {
                            cpu: {
                              properties: {
                                total: { type: 'float' },
                              },
                            },
                            name: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });
      });
    });

    it('should return nested fields', async () => {
      const fieldObjects = await ctx.ds.getFields();

      const fields = _.map(fieldObjects, 'text');

      expect(fields).toEqual([
        '@timestamp',
        '__timestamp',
        '@timestampnano',
        'beat.name.raw',
        'beat.name',
        'beat.hostname',
        'system.cpu.system',
        'system.cpu.user',
        'system.process.cpu.total',
        'system.process.name',
      ]);
    });

    it('should return number fields', async () => {
      const fieldObjects = await ctx.ds.getFields('number');

      const fields = _.map(fieldObjects, 'text');

      expect(fields).toEqual(['system.cpu.system', 'system.cpu.user', 'system.process.cpu.total']);
    });

    it('should return date fields', async () => {
      const fieldObjects = await ctx.ds.getFields('date');

      const fields = _.map(fieldObjects, 'text');

      expect(fields).toEqual(['@timestamp', '__timestamp', '@timestampnano']);
    });
  });

  describe('When getting field mappings on indices with gaps', () => {
    const twoWeekTimeSrv: any = createTimeSrv('now-2w');

    const basicResponse = {
      data: {
        metricbeat: {
          mappings: {
            metricsets: {
              _all: {},
              properties: {
                '@timestamp': { type: 'date' },
                beat: {
                  properties: {
                    hostname: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    };

    const alternateResponse = {
      data: {
        metricbeat: {
          mappings: {
            metricsets: {
              _all: {},
              properties: {
                '@timestamp': { type: 'date' },
              },
            },
          },
        },
      },
    };

    beforeEach(() => {
      createDatasourceWithTime(
        {
          url: ELASTICSEARCH_MOCK_URL,
          database: '[asd-]YYYY.MM.DD',
          jsonData: { interval: 'Daily', esVersion: 50 } as ElasticsearchOptions,
        } as DataSourceInstanceSettings<ElasticsearchOptions>,
        twoWeekTimeSrv
      );
    });

    it('should return fields of the newest available index', async () => {
      const twoDaysBefore = toUtc()
        .subtract(2, 'day')
        .format('YYYY.MM.DD');

      const threeDaysBefore = toUtc()
        .subtract(3, 'day')
        .format('YYYY.MM.DD');

      datasourceRequestMock.mockImplementation(options => {
        if (options.url === `${ELASTICSEARCH_MOCK_URL}/asd-${twoDaysBefore}/_mapping`) {
          return Promise.resolve(basicResponse);
        } else if (options.url === `${ELASTICSEARCH_MOCK_URL}/asd-${threeDaysBefore}/_mapping`) {
          return Promise.resolve(alternateResponse);
        }
        return Promise.reject({ status: 404 });
      });

      const fieldObjects = await ctx.ds.getFields();

      const fields = _.map(fieldObjects, 'text');
      expect(fields).toEqual(['@timestamp', 'beat.hostname']);
    });

    it('should not retry when ES is down', async () => {
      const twoDaysBefore = toUtc()
        .subtract(2, 'day')
        .format('YYYY.MM.DD');

      datasourceRequestMock.mockImplementation(options => {
        if (options.url === `${ELASTICSEARCH_MOCK_URL}/asd-${twoDaysBefore}/_mapping`) {
          return Promise.resolve(basicResponse);
        }
        return Promise.reject({ status: 500 });
      });

      expect.assertions(2);
      try {
        await ctx.ds.getFields();
      } catch (e) {
        expect(e).toStrictEqual({ status: 500 });
        expect(datasourceRequestMock).toBeCalledTimes(1);
      }
    });

    it('should not retry more than 7 indices', async () => {
      datasourceRequestMock.mockImplementation(() => {
        return Promise.reject({ status: 404 });
      });

      expect.assertions(2);
      try {
        await ctx.ds.getFields();
      } catch (e) {
        expect(e).toStrictEqual({ status: 404 });
        expect(datasourceRequestMock).toBeCalledTimes(7);
      }
    });
  });

  describe('When getting fields from ES 7.0', () => {
    beforeEach(() => {
      createDatasource({
        url: ELASTICSEARCH_MOCK_URL,
        database: 'genuine.es7._mapping.response',
        jsonData: { esVersion: 70 } as ElasticsearchOptions,
      } as DataSourceInstanceSettings<ElasticsearchOptions>);

      datasourceRequestMock.mockImplementation(options => {
        return Promise.resolve({
          data: {
            'genuine.es7._mapping.response': {
              mappings: {
                properties: {
                  '@timestamp_millis': {
                    type: 'date',
                    format: 'epoch_millis',
                  },
                  classification_terms: {
                    type: 'keyword',
                  },
                  domains: {
                    type: 'keyword',
                  },
                  ip_address: {
                    type: 'ip',
                  },
                  justification_blob: {
                    properties: {
                      criterion: {
                        type: 'text',
                        fields: {
                          keyword: {
                            type: 'keyword',
                            ignore_above: 256,
                          },
                        },
                      },
                      overall_vote_score: {
                        type: 'float',
                      },
                      shallow: {
                        properties: {
                          jsi: {
                            properties: {
                              sdb: {
                                properties: {
                                  dsel2: {
                                    properties: {
                                      'bootlegged-gille': {
                                        properties: {
                                          botness: {
                                            type: 'float',
                                          },
                                          general_algorithm_score: {
                                            type: 'float',
                                          },
                                        },
                                      },
                                      'uncombed-boris': {
                                        properties: {
                                          botness: {
                                            type: 'float',
                                          },
                                          general_algorithm_score: {
                                            type: 'float',
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  overall_vote_score: {
                    type: 'float',
                  },
                  ua_terms_long: {
                    type: 'keyword',
                  },
                  ua_terms_short: {
                    type: 'keyword',
                  },
                },
              },
            },
          },
        });
      });
    });

    it('should return nested fields', async () => {
      const fieldObjects = await ctx.ds.getFields();

      const fields = _.map(fieldObjects, 'text');

      expect(fields).toEqual([
        '@timestamp_millis',
        'classification_terms',
        'domains',
        'ip_address',
        'justification_blob.criterion.keyword',
        'justification_blob.criterion',
        'justification_blob.overall_vote_score',
        'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.botness',
        'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.general_algorithm_score',
        'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.botness',
        'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.general_algorithm_score',
        'overall_vote_score',
        'ua_terms_long',
        'ua_terms_short',
      ]);
    });

    it('should return number fields', async () => {
      const fieldObjects = await ctx.ds.getFields('number');

      const fields = _.map(fieldObjects, 'text');

      expect(fields).toEqual([
        'justification_blob.overall_vote_score',
        'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.botness',
        'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.general_algorithm_score',
        'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.botness',
        'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.general_algorithm_score',
        'overall_vote_score',
      ]);
    });

    it('should return date fields', async () => {
      const fieldObjects = await ctx.ds.getFields('date');

      const fields = _.map(fieldObjects, 'text');

      expect(fields).toEqual(['@timestamp_millis']);
    });
  });

  describe('When issuing aggregation query on es5.x', () => {
    let requestOptions: any, parts: any, header: any;

    beforeEach(() => {
      createDatasource({
        url: ELASTICSEARCH_MOCK_URL,
        database: 'test',
        jsonData: { esVersion: 5 } as ElasticsearchOptions,
      } as DataSourceInstanceSettings<ElasticsearchOptions>);

      datasourceRequestMock.mockImplementation(options => {
        requestOptions = options;
        return Promise.resolve({ data: { responses: [] } });
      });

      const query: DataQueryRequest<ElasticsearchQuery> = {
        range: createTimeRange(dateTime([2015, 4, 30, 10]), dateTime([2015, 5, 1, 10])),
        targets: [
          {
            refId: 'A',
            bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
            metrics: [{ type: 'count', id: '1' }],
            query: 'test',
          },
        ],
      } as DataQueryRequest<ElasticsearchQuery>;

      ctx.ds.query(query);

      parts = requestOptions.data.split('\n');
      header = JSON.parse(parts[0]);
    });

    it('should not set search type to count', () => {
      expect(header.search_type).not.toEqual('count');
    });

    it('should set size to 0', () => {
      const body = JSON.parse(parts[1]);
      expect(body.size).toBe(0);
    });
  });

  describe('When issuing metricFind query on es5.x', () => {
    let requestOptions: any, parts, header: any, body: any;
    let results: MetricFindValue[];

    beforeEach(() => {
      createDatasource({
        url: ELASTICSEARCH_MOCK_URL,
        database: 'test',
        jsonData: { esVersion: 5 } as ElasticsearchOptions,
      } as DataSourceInstanceSettings<ElasticsearchOptions>);

      datasourceRequestMock.mockImplementation(options => {
        requestOptions = options;
        return Promise.resolve({
          data: {
            responses: [
              {
                aggregations: {
                  '1': {
                    buckets: [
                      { doc_count: 1, key: 'test' },
                      {
                        doc_count: 2,
                        key: 'test2',
                        key_as_string: 'test2_as_string',
                      },
                    ],
                  },
                },
              },
            ],
          },
        });
      });

      ctx.ds.metricFindQuery('{"find": "terms", "field": "test"}').then(res => {
        results = res;
      });

      parts = requestOptions.data.split('\n');
      header = JSON.parse(parts[0]);
      body = JSON.parse(parts[1]);
    });

    it('should get results', () => {
      expect(results.length).toEqual(2);
    });

    it('should use key or key_as_string', () => {
      expect(results[0].text).toEqual('test');
      expect(results[1].text).toEqual('test2_as_string');
    });

    it('should not set search type to count', () => {
      expect(header.search_type).not.toEqual('count');
    });

    it('should set size to 0', () => {
      expect(body.size).toBe(0);
    });

    it('should not set terms aggregation size to 0', () => {
      expect(body['aggs']['1']['terms'].size).not.toBe(0);
    });
  });

  describe('PPL Queries', () => {
    const defaultPPLQuery =
      "source=`test` | where `@time` >= timestamp('2015-05-30 10:00:00') and `@time` <= timestamp('2015-06-01 10:00:00')";

    function setup(targets: ElasticsearchQuery[]) {
      createDatasource({
        url: ELASTICSEARCH_MOCK_URL,
        database: 'test',
        jsonData: { esVersion: 70, timeField: '@time' } as ElasticsearchOptions,
      } as DataSourceInstanceSettings<ElasticsearchOptions>);

      const options: DataQueryRequest<ElasticsearchQuery> = {
        requestId: '',
        interval: '',
        intervalMs: 1,
        scopedVars: {},
        timezone: '',
        app: CoreApp.Dashboard,
        startTime: 0,
        range: createTimeRange(dateTime([2015, 4, 30, 10]), dateTime([2015, 5, 1, 10])),
        targets,
      };

      return { ds: ctx.ds, options };
    }

    describe('When issuing empty PPL Query', () => {
      const payloads: any[] = [];

      const targets = [
        {
          queryType: ElasticsearchQueryType.PPL,
          query: '',
          refId: 'A',
          isLogsQuery: false,
        },
      ];

      beforeAll(() => {
        datasourceRequestMock.mockImplementation(options => {
          payloads.push(options);
          return Promise.resolve({ data: { schema: [], datarows: [] } });
        });
      });

      it('should send the correct data source request', async () => {
        const { ds, options } = setup(targets);
        await ds.query(options).toPromise();
        expect(payloads.length).toBe(1);
        expect(payloads[0].url).toBe(`${ELASTICSEARCH_MOCK_URL}/_opendistro/_ppl`);
        expect(JSON.parse(payloads[0].data).query).toBe(defaultPPLQuery);
      });

      it('should handle the data source response', async () => {
        const { ds, options } = setup(targets);
        await expect(ds.query(options)).toEmitValuesWith(received => {
          const result = received[0];
          expect(result).toEqual(
            expect.objectContaining({
              data: [],
            })
          );
        });
      });
    });

    describe('When issuing table format PPL Query', () => {
      const payloads: any[] = [];

      const targets = [
        {
          queryType: ElasticsearchQueryType.PPL,
          query: 'source=`test` | where age > 21 | fields firstname, lastname',
          refId: 'A',
          format: 'table',
          isLogsQuery: false,
        },
      ];

      const pplTableResponse = {
        data: {
          schema: [
            {
              name: 'firstname',
              type: 'string',
            },
            {
              name: 'lastname',
              type: 'string',
            },
          ],
          datarows: [
            ['Amber', 'Duke'],
            ['Hattie', 'Bond'],
          ],
          size: 2,
          total: 2,
        },
      };

      beforeAll(() => {
        datasourceRequestMock.mockImplementation(options => {
          payloads.push(options);
          return Promise.resolve(pplTableResponse);
        });
      });

      it('should send the correct data source request', async () => {
        const { ds, options } = setup(targets);
        await ds.query(options).toPromise();
        const expectedQuery = `${defaultPPLQuery} | where age > 21 | fields firstname, lastname`;
        expect(payloads.length).toBe(1);
        expect(payloads[0].url).toBe(`${ELASTICSEARCH_MOCK_URL}/_opendistro/_ppl`);
        expect(JSON.parse(payloads[0].data).query).toBe(expectedQuery);
      });

      it('should handle the data source response', async () => {
        const { ds, options } = setup(targets);
        await expect(ds.query(options)).toEmitValuesWith((received: DataQueryResponse[]) => {
          const result = received[0];
          const dataFrame = result.data[0] as DataFrame;
          expect(dataFrame.length).toBe(2);
          expect(dataFrame.refId).toBe('A');
          const fieldCache = new FieldCache(dataFrame);
          const field = fieldCache.getFieldByName('lastname');
          expect(field?.values.toArray()).toEqual(['Duke', 'Bond']);
        });
      });
    });

    describe('When issuing logs format PPL Query', () => {
      const payloads: any[] = [];

      const targets = [
        {
          queryType: ElasticsearchQueryType.PPL,
          query: 'source=`test` | fields clientip, response',
          refId: 'B',
          format: 'logs',
          isLogsQuery: false,
        },
      ];

      const pplLogsResponse = {
        data: {
          schema: [
            {
              name: 'clientip',
              type: 'string',
            },
            {
              name: 'response',
              type: 'string',
            },
          ],
          datarows: [
            ['10.0.0.1', '200'],
            ['10.0.0.2', '200'],
          ],
          size: 2,
          total: 2,
        },
      };

      beforeAll(() => {
        datasourceRequestMock.mockImplementation(options => {
          payloads.push(options);
          return Promise.resolve(pplLogsResponse);
        });
      });

      it('should send the correct data source request', async () => {
        const { ds, options } = setup(targets);
        await ds.query(options).toPromise();
        const expectedQuery = `${defaultPPLQuery} | fields clientip, response`;
        expect(payloads.length).toBe(1);
        expect(payloads[0].url).toBe(`${ELASTICSEARCH_MOCK_URL}/_opendistro/_ppl`);
        expect(JSON.parse(payloads[0].data).query).toBe(expectedQuery);
      });

      it('should handle the data source response', async () => {
        const { ds, options } = setup(targets);
        await expect(ds.query(options)).toEmitValuesWith((received: DataQueryResponse[]) => {
          const result = received[0];
          const dataFrame = result.data[0] as DataFrame;
          expect(dataFrame.length).toBe(2);
          expect(dataFrame.refId).toBe('B');
          expect(dataFrame.meta?.preferredVisualisationType).toBe('logs');
          const fieldCache = new FieldCache(dataFrame);
          const field = fieldCache.getFieldByName('clientip');
          expect(field?.values.toArray()).toEqual(['10.0.0.1', '10.0.0.2']);
        });
      });
    });

    describe('When issuing time series format PPL Query', () => {
      const payloads: any[] = [];

      const targets = [
        {
          queryType: ElasticsearchQueryType.PPL,
          query: 'source=`test` | stats count(response) by timestamp',
          refId: 'C',
          format: 'time_series',
          isLogsQuery: false,
        },
      ];

      const pplTimeSeriesResponse = {
        data: {
          schema: [
            {
              name: 'count(response)',
              type: 'integer',
            },
            {
              name: 'time',
              type: 'timestamp',
            },
          ],
          datarows: [[4, '2015-06-01 00:00:00']],
          size: 1,
          total: 1,
        },
      };

      beforeAll(() => {
        datasourceRequestMock.mockImplementation(options => {
          payloads.push(options);
          return Promise.resolve(pplTimeSeriesResponse);
        });
      });

      it('should send the correct data source request', async () => {
        const { ds, options } = setup(targets);
        await ds.query(options).toPromise();
        const expectedQuery = `${defaultPPLQuery} | stats count(response) by timestamp`;
        expect(payloads.length).toBe(1);
        expect(payloads[0].url).toBe(`${ELASTICSEARCH_MOCK_URL}/_opendistro/_ppl`);
        expect(JSON.parse(payloads[0].data).query).toBe(expectedQuery);
      });

      it('should handle the data source response', async () => {
        const { ds, options } = setup(targets);
        await expect(ds.query(options)).toEmitValuesWith((received: DataQueryResponse[]) => {
          const result = received[0];
          const timeSeries = result.data[0] as TimeSeries;
          expect(timeSeries.datapoints.length).toBe(1);
          expect(timeSeries.refId).toBe('C');
          expect(timeSeries.target).toEqual('count(response)');
        });
      });
    });

    describe('When issuing two PPL Queries', () => {
      const payloads: any[] = [];

      const targets = [
        {
          queryType: ElasticsearchQueryType.PPL,
          query: 'source=`test` | fields firstname',
          refId: 'A',
          format: 'table',
          isLogsQuery: false,
        },
        {
          queryType: ElasticsearchQueryType.PPL,
          query: 'source=`test` | fields lastname',
          refId: 'B',
          format: 'table',
          isLogsQuery: false,
        },
      ];

      beforeAll(() => {
        datasourceRequestMock.mockImplementation(options => {
          payloads.push(options);
          return Promise.resolve({ data: { schema: [], datarows: [] } });
        });
      });

      it('should send the correct data source requests', async () => {
        const { ds, options } = setup(targets);
        await ds.query(options).toPromise();
        const firstExpectedQuery = `${defaultPPLQuery} | fields firstname`;
        const secondExpectedQuery = `${defaultPPLQuery} | fields lastname`;

        expect(payloads.length).toBe(2);
        expect(payloads.some(payload => JSON.parse(payload.data).query === firstExpectedQuery));
        expect(payloads.some(payload => JSON.parse(payload.data).query === secondExpectedQuery));
      });

      it('should handle the data source responses', async () => {
        const { ds, options } = setup(targets);
        await expect(ds.query(options)).toEmitValuesWith((received: DataQueryResponse[]) => {
          expect(received.length).toBe(2);
          expect(received).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                data: [],
              }),
              expect.objectContaining({
                data: [],
              }),
            ])
          );
          expect(received[0].key && received[1].key && received[0].key !== received[1].key).toBe(true);
        });
      });
    });

    describe('When issuing PPL query and Lucene query', () => {
      const payloads: any[] = [];

      const targets = [
        {
          queryType: ElasticsearchQueryType.PPL,
          query: '',
          refId: 'A',
          isLogsQuery: false,
        },
        {
          queryType: ElasticsearchQueryType.Lucene,
          query: '*',
          refId: 'B',
          isLogsQuery: false,
        },
      ];

      beforeAll(() => {
        datasourceRequestMock.mockImplementation(options => {
          payloads.push(options);
          if (options.url === `${ELASTICSEARCH_MOCK_URL}/_opendistro/_ppl`) {
            return Promise.resolve({ data: { schema: [], datarows: [] } });
          } else {
            return Promise.resolve({ data: { responses: [] } });
          }
        });
      });

      it('should send the correct data source requests', async () => {
        const { ds, options } = setup(targets);
        await ds.query(options).toPromise();
        expect(payloads.length).toBe(2);
        expect(payloads).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ url: `${ELASTICSEARCH_MOCK_URL}/_opendistro/_ppl` }),
            expect.objectContaining({ url: `${ELASTICSEARCH_MOCK_URL}/_msearch` }),
          ])
        );
      });

      it('should handle the data source responses', async () => {
        const { ds, options } = setup(targets);
        await expect(ds.query(options)).toEmitValuesWith((received: DataQueryResponse[]) => {
          expect(received.length).toBe(2);
          expect(received).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                data: [],
              }),
              expect.objectContaining({
                data: [],
              }),
            ])
          );
          expect(received[0].key && received[1].key && received[0].key !== received[1].key).toBe(true);
        });
      });
    });

    describe('When getting an error with reason in data source response', () => {
      const targets = [
        {
          queryType: ElasticsearchQueryType.PPL,
          query: '',
          refId: 'A',
          isLogsQuery: false,
        },
      ];

      beforeAll(() => {
        datasourceRequestMock.mockImplementation(() => {
          return Promise.resolve({
            data: {
              error: {
                reason: 'Error occurred in Elasticsearch engine: no such index [unknown]',
                details: 'org.elasticsearch.index.IndexNotFoundException: no such index [unknown]',
                type: 'IndexNotFoundException',
              },
              status: 404,
            },
          });
        });
      });

      it('should process it properly', async () => {
        const { ds, options } = setup(targets);
        await expect(ds.query(options).toPromise()).rejects.toEqual(
          expect.objectContaining({
            message: 'Error occurred in Elasticsearch engine: no such index [unknown]',
          })
        );
      });
    });

    describe('When getting an empty error in data source response', () => {
      const targets = [
        {
          queryType: ElasticsearchQueryType.PPL,
          query: '',
          refId: 'A',
          isLogsQuery: false,
        },
      ];

      beforeAll(() => {
        datasourceRequestMock.mockImplementation(() => {
          return Promise.resolve({
            data: {
              error: {},
              status: 404,
            },
          });
        });
      });

      it('should properly throw an unknown error', async () => {
        const { ds, options } = setup(targets);
        await expect(ds.query(options).toPromise()).rejects.toEqual(
          expect.objectContaining({
            message: 'Unknown elastic error response',
          })
        );
      });
    });
  });

  describe('query', () => {
    it('should replace range as integer not string', () => {
      const dataSource = new ElasticDatasource(
        {
          url: ELASTICSEARCH_MOCK_URL,
          database: '[asd-]YYYY.MM.DD',
          jsonData: {
            interval: 'Daily',
            esVersion: 2,
            timeField: '@time',
          },
        } as DataSourceInstanceSettings<ElasticsearchOptions>,
        templateSrv as TemplateSrv,
        timeSrv as TimeSrv
      );
      (dataSource as any).post = jest.fn(() => Promise.resolve({ responses: [] }));
      dataSource.query(createElasticQuery());

      const query = ((dataSource as any).post as jest.Mock).mock.calls[0][1];
      expect(typeof JSON.parse(query.split('\n')[1]).query.bool.filter[0].range['@time'].gte).toBe('number');
    });

    it('should correctly interpolate variables in query', () => {
      const query: ElasticsearchQuery = {
        refId: 'A',
        bucketAggs: [{ type: 'filters', settings: { filters: [{ query: '$var', label: '' }] }, id: '1' }],
        metrics: [{ type: 'count', id: '1' }],
        query: '$var',
      };

      const interpolatedQuery = ctx.ds.interpolateVariablesInQueries([query], {})[0];

      expect(interpolatedQuery.query).toBe('resolvedVariable');
      expect((interpolatedQuery.bucketAggs![0] as Filters).settings!.filters![0].query).toBe('resolvedVariable');
    });

    it('should correctly handle empty Lucene query strings', () => {
      const query: ElasticsearchQuery = {
        refId: 'A',
        bucketAggs: [{ type: 'filters', settings: { filters: [{ query: '', label: '' }] }, id: '1' }],
        metrics: [{ type: 'count', id: '1' }],
        query: '',
      };

      const interpolatedQuery = ctx.ds.interpolateVariablesInQueries([query], {})[0];

      expect(interpolatedQuery.query).toBe('*');
      expect((interpolatedQuery.bucketAggs![0] as Filters).settings!.filters![0].query).toBe('*');
    });

    it('should correctly handle empty PPL query strings', () => {
      const query: ElasticsearchQuery = {
        refId: 'A',
        queryType: ElasticsearchQueryType.PPL,
        query: '',
      };

      const interpolatedQuery = ctx.ds.interpolateVariablesInQueries([query], {})[0];

      expect(interpolatedQuery.query).toBe('');
    });
  });
});

describe('enhanceDataFrame', () => {
  it('adds links to dataframe', () => {
    const df = new MutableDataFrame({
      fields: [
        {
          name: 'urlField',
          values: new ArrayVector([]),
        },
        {
          name: 'traceField',
          values: new ArrayVector([]),
        },
      ],
    });

    enhanceDataFrame(df, [
      {
        field: 'urlField',
        url: 'someUrl',
      },
      {
        field: 'traceField',
        url: 'query',
        datasourceUid: 'dsUid',
      },
    ]);

    expect(df.fields[0].config.links!.length).toBe(1);
    expect(df.fields[0].config.links![0]).toEqual({
      title: '',
      url: 'someUrl',
    });
    expect(df.fields[1].config.links!.length).toBe(1);
    expect(df.fields[1].config.links![0]).toEqual({
      title: '',
      url: '',
      internal: {
        query: { query: 'query' },
        datasourceName: 'elastic25',
        datasourceUid: 'dsUid',
      },
    });
  });
});

const createElasticQuery = (): DataQueryRequest<ElasticsearchQuery> => {
  return {
    requestId: '',
    dashboardId: 0,
    interval: '',
    panelId: 0,
    intervalMs: 1,
    scopedVars: {},
    timezone: '',
    app: CoreApp.Dashboard,
    startTime: 0,
    range: {
      from: dateTime([2015, 4, 30, 10]),
      to: dateTime([2015, 5, 1, 10]),
    } as any,
    targets: [
      {
        refId: '',
        isLogsQuery: false,
        bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
        metrics: [{ type: 'count', id: '' }],
        query: 'test',
      },
    ],
  };
};

const logsResponse = {
  data: {
    responses: [
      {
        aggregations: {
          '2': {
            buckets: [
              {
                doc_count: 10,
                key: 1000,
              },
              {
                doc_count: 15,
                key: 2000,
              },
            ],
          },
        },
        hits: {
          hits: [
            {
              '@timestamp': ['2019-06-24T09:51:19.765Z'],
              _id: 'fdsfs',
              _type: '_doc',
              _index: 'mock-index',
              _source: {
                '@timestamp': '2019-06-24T09:51:19.765Z',
                host: 'djisaodjsoad',
                message: 'hello, i am a message',
              },
              fields: {
                '@timestamp': ['2019-06-24T09:51:19.765Z'],
              },
            },
            {
              '@timestamp': ['2019-06-24T09:52:19.765Z'],
              _id: 'kdospaidopa',
              _type: '_doc',
              _index: 'mock-index',
              _source: {
                '@timestamp': '2019-06-24T09:52:19.765Z',
                host: 'dsalkdakdop',
                message: 'hello, i am also message',
              },
              fields: {
                '@timestamp': ['2019-06-24T09:52:19.765Z'],
              },
            },
          ],
        },
      },
    ],
  },
};
