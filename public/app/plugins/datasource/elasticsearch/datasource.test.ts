import { map } from 'lodash';
import { of, throwError } from 'rxjs';

import {
  CoreApp,
  DataQueryRequest,
  DateTime,
  dateTime,
  Field,
  LoadingState,
  SupplementaryQueryType,
  TimeRange,
  toUtc,
} from '@grafana/data';
import { FetchResponse, reportInteraction, getBackendSrv, setBackendSrv, BackendSrv, config } from '@grafana/runtime';

import { ElasticDatasource } from './datasource';
import { createElasticDatasource, createElasticQuery, mockResponseFrames } from './mocks';
import { Filters, ElasticsearchQuery } from './types';

const originalConsoleError = console.error;
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
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

const timeRangeMock = createTimeRange(toUtc([2022, 8, 21, 6, 10, 10]), toUtc([2022, 8, 24, 6, 10, 21]));
const dataQueryDefaults = {
  requestId: '1',
  interval: '',
  intervalMs: 0,
  scopedVars: {
    test: { text: '', value: '' },
  },
  timezone: '',
  app: 'test',
  startTime: 0,
  range: timeRangeMock,
  targets: [{ refId: 'A' }],
};

function createResponse<T>(data: T): FetchResponse<T> {
  return {
    data,
    status: 200,
    url: 'http://localhost:3000/api/ds/query',
    config: { url: 'http://localhost:3000/api/ds/query' },
    type: 'basic',
    statusText: 'Ok',
    redirected: false,
    headers: new Headers(),
    ok: true,
  };
}

describe('ElasticDatasource', () => {
  let origBackendSrv: BackendSrv;
  let ds: ElasticDatasource;
  beforeEach(() => {
    console.error = jest.fn();
    origBackendSrv = getBackendSrv();
    setBackendSrv({ ...origBackendSrv, fetch: jest.fn().mockReturnValue(of({ data: {} })) });
    ds = createElasticDatasource();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    setBackendSrv(origBackendSrv);
    jest.clearAllMocks();
  });

  describe('getTagValues', () => {
    it('should respect the currently selected time range', () => {
      const ds = createElasticDatasource({ jsonData: { timeField: '@timestamp' } });
      const getTagValuesData = {
        responses: [
          {
            aggregations: {
              '1': {
                buckets: [
                  {
                    doc_count: 10,
                    key: 'val1',
                  },
                  {
                    doc_count: 20,
                    key: 'val2',
                  },
                  {
                    doc_count: 30,
                    key: 'val3',
                  },
                ],
              },
            },
          },
        ],
      };
      const postResource = jest.spyOn(ds, 'postResourceRequest').mockResolvedValue(getTagValuesData);
      ds.getTagValues({ key: 'test', timeRange: timeRangeMock, filters: [] });
      expect(postResource).toHaveBeenCalledTimes(1);
      const esQuery = JSON.parse(postResource.mock.calls[0][1].split('\n')[1]);
      const { lte, gte } = esQuery.query.bool.filter[0].range['@timestamp'];

      expect(gte).toBe('1663740610000'); // 2022-09-21T06:10:10Z
      expect(lte).toBe('1663999821000'); // 2022-09-24T06:10:21Z
    });

    it('should return fields properly', async () => {
      const ds = createElasticDatasource({ jsonData: { timeField: '@timestamp' } });
      const getTagValuesData = {
        responses: [
          {
            aggregations: {
              '1': {
                buckets: [
                  {
                    doc_count: 10,
                    key: 'foo',
                  },
                  {
                    doc_count: 20,
                    key: 6,
                    key_as_string: 'six',
                  },
                  {
                    doc_count: 30,
                    key: 7,
                  },
                ],
              },
            },
          },
        ],
      };
      const postResource = jest.spyOn(ds, 'postResourceRequest').mockResolvedValue(getTagValuesData);
      const values = await ds.getTagValues({ key: 'test', timeRange: timeRangeMock, filters: [] });
      expect(postResource).toHaveBeenCalledTimes(1);

      expect(values.length).toBe(3);
      expect(values[0].text).toBe('foo');
      expect(values[0].value).toBe('foo');

      expect(values[1].text).toBe('six');
      expect(values[1].value).toBe('6');

      expect(values[2].text).toBe('7');
      expect(values[2].value).toBe('7');
    });
  });

  describe('query', () => {
    it('should run applyTemplate variables when executing query', () => {
      const query = { ...createElasticQuery(), targets: [{ ...createElasticQuery().targets[0], query: '$varAlias' }] };
      const applyTemplateVariables = jest.spyOn(ds, 'applyTemplateVariables');
      ds.query(query);
      expect(applyTemplateVariables).toHaveBeenCalledWith(query.targets[0], {}, undefined);
      expect(applyTemplateVariables).toHaveReturnedWith(
        expect.objectContaining({ ...query.targets[0], query: 'resolvedVariable' })
      );
    });

    it('should enhance data frames with data links', async () => {
      const query = createElasticQuery();
      const fieldToEnhance = '@timestamp';
      ds.dataLinks = [
        {
          field: fieldToEnhance,
          url: 'http://localhost:3000/${__value.raw}',
          urlDisplayLabel: 'Custom Label',
        },
      ];
      setBackendSrv({
        ...origBackendSrv,
        fetch: jest.fn().mockReturnValue(
          of(
            createResponse({
              results: {
                A: {
                  frames: mockResponseFrames,
                  refId: 'A',
                  status: 200,
                },
              },
            })
          )
        ),
      });
      await expect(ds.query(query)).toEmitValuesWith((received) => {
        const enhancedField = received[0].data[0].fields.find((field: Field) => field.name === fieldToEnhance);
        expect(enhancedField.config.links).toHaveLength(1);
        expect(enhancedField.config.links).toContainEqual({
          title: 'Custom Label',
          url: 'http://localhost:3000/${__value.raw}',
        });
      });
    });

    it('should return correct error', async () => {
      const query = createElasticQuery();
      setBackendSrv({
        ...origBackendSrv,
        fetch: jest.fn().mockReturnValue(
          of({
            data: {
              results: {
                A: {
                  error: 'Post "http://localhost:9200/_msearch?max_concurrent_shard_requests=5": 400 Bad Request',
                  errorSource: 'downstream',
                  status: 500,
                },
              },
            },
          })
        ),
      });
      await expect(ds.query(query)).toEmitValuesWith((received) => {
        const errorData = {
          message: 'Post "http://localhost:9200/_msearch?max_concurrent_shard_requests=5": 400 Bad Request',
          refId: 'A',
          status: 500,
        };
        expect(received[0].error).toEqual(errorData);
        expect(received[0].state).toBe(LoadingState.Error);
        expect(received[0].errors?.[0]).toEqual(errorData);
      });
    });

    describe('reportInteraction', () => {
      it('should report metric query', async () => {
        const query = { ...createElasticQuery(), app: CoreApp.Explore };
        await expect(ds.query(query)).toEmitValuesWith((received) => {
          expect(received[0].state).toBe(LoadingState.Done);
          expect(reportInteraction).toHaveBeenCalledWith(
            'grafana_elasticsearch_query_executed',
            expect.objectContaining({
              app: CoreApp.Explore,
              has_data: false,
              has_error: false,
              line_limit: undefined,
              query_type: 'metric',
              simultaneously_sent_query_count: 1,
              with_lucene_query: true,
            })
          );
        });
      });

      it('should report log query', async () => {
        const query = {
          ...createElasticQuery(),
          targets: [
            {
              refId: 'A',
              metrics: [{ type: 'logs', id: '1' }],
              query: 'foo="bar"',
            } as ElasticsearchQuery,
          ],
          app: CoreApp.Explore,
        };
        expect(ds.query(query)).toEmitValuesWith((received) => {
          expect(received[0].state).toBe(LoadingState.Done);
          expect(reportInteraction).toHaveBeenCalledWith(
            'grafana_elasticsearch_query_executed',
            expect.objectContaining({
              app: CoreApp.Explore,
              has_data: false,
              has_error: false,
              line_limit: undefined,
              query_type: 'logs',
              simultaneously_sent_query_count: 1,
              with_lucene_query: true,
            })
          );
        });
      });

      it('should report raw_data query', async () => {
        const query = {
          ...createElasticQuery(),
          targets: [
            {
              refId: 'A',
              metrics: [{ type: 'raw_data', id: '1' }],
              query: 'foo="bar"',
            } as ElasticsearchQuery,
          ],
          app: CoreApp.Explore,
        };
        await expect(ds.query(query)).toEmitValuesWith((received) => {
          expect(received[0].state).toBe(LoadingState.Done);
          expect(reportInteraction).toHaveBeenCalledWith(
            'grafana_elasticsearch_query_executed',
            expect.objectContaining({
              app: CoreApp.Explore,
              has_data: false,
              has_error: false,
              line_limit: undefined,
              query_type: 'raw_data',
              simultaneously_sent_query_count: 1,
              with_lucene_query: true,
            })
          );
        });
      });

      it('should not report queries from dashboard', async () => {
        const query = {
          ...createElasticQuery(),
          targets: [
            {
              refId: 'A',
              metrics: [{ type: 'raw_data', id: '1' }],
              query: 'foo="bar"',
            } as ElasticsearchQuery,
          ],
          app: CoreApp.Dashboard,
        };
        await expect(ds.query(query)).toEmitValuesWith((received) => {
          expect(received[0].state).toBe(LoadingState.Done);
          expect(reportInteraction).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('interpolateVariablesInQueries', () => {
    it('should correctly interpolate variables in query', () => {
      const query: ElasticsearchQuery = {
        refId: 'A',
        bucketAggs: [{ type: 'filters', settings: { filters: [{ query: '$var', label: '' }] }, id: '1' }],
        metrics: [{ type: 'count', id: '1' }],
        query: '$var',
      };

      const interpolatedQuery = ds.interpolateVariablesInQueries([query], {})[0];
      expect(interpolatedQuery.query).toBe('resolvedVariable');
      expect((interpolatedQuery.bucketAggs![0] as Filters).settings!.filters![0].query).toBe('resolvedVariable');
    });

    it('should correctly add ad hoc filters when interpolating variables in query', () => {
      const adHocFilters = [{ key: 'bar', operator: '=', value: 'test' }];
      const query: ElasticsearchQuery = {
        refId: 'A',
        bucketAggs: [{ type: 'filters', settings: { filters: [{ query: '$var', label: '' }] }, id: '1' }],
        metrics: [{ type: 'count', id: '1' }],
        query: 'foo:"bar"',
      };

      const interpolatedQuery = ds.interpolateVariablesInQueries([query], {}, adHocFilters)[0];
      expect(interpolatedQuery.query).toBe('foo:"bar" AND bar:"test"');
    });

    it('should correctly handle empty query strings in filters bucket aggregation', () => {
      const query: ElasticsearchQuery = {
        refId: 'A',
        bucketAggs: [{ type: 'filters', settings: { filters: [{ query: '', label: '' }] }, id: '1' }],
        metrics: [{ type: 'count', id: '1' }],
        query: '',
      };

      const interpolatedQuery = ds.interpolateVariablesInQueries([query], {})[0];
      expect((interpolatedQuery.bucketAggs![0] as Filters).settings!.filters![0].query).toBe('*');
    });
  });

  describe('getSupplementaryQuery', () => {
    it('does not return logs volume query for metric query', () => {
      expect(
        ds.getSupplementaryQuery(
          { type: SupplementaryQueryType.LogsVolume },
          {
            refId: 'A',
            metrics: [{ type: 'count', id: '1' }],
            bucketAggs: [{ type: 'filters', settings: { filters: [{ query: 'foo', label: '' }] }, id: '1' }],
            query: 'foo="bar"',
          }
        )
      ).toEqual(undefined);
    });

    it('does not return logs volume query for hidden query', () => {
      expect(
        ds.getSupplementaryQuery(
          { type: SupplementaryQueryType.LogsVolume },
          {
            refId: 'A',
            metrics: [{ type: 'logs', id: '1' }],
            query: 'foo="bar"',
            hide: true,
          }
        )
      ).toEqual(undefined);
    });

    it('returns logs volume query for log query', () => {
      expect(
        ds.getSupplementaryQuery(
          { type: SupplementaryQueryType.LogsVolume },
          {
            refId: 'A',
            metrics: [{ type: 'logs', id: '1' }],
            query: 'foo="bar"',
          }
        )
      ).toEqual({
        bucketAggs: [
          {
            field: '',
            id: '3',
            settings: {
              interval: 'auto',
              min_doc_count: '0',
              trimEdges: '0',
            },
            type: 'date_histogram',
          },
        ],
        metrics: [
          {
            id: '1',
            type: 'count',
          },
        ],
        query: 'foo="bar"',
        refId: 'log-volume-A',
        timeField: '',
      });
    });

    it('does not return logs samples for non time series queries', () => {
      expect(
        ds.getSupplementaryQuery(
          { type: SupplementaryQueryType.LogsSample, limit: 100 },
          {
            refId: 'A',
            bucketAggs: [{ type: 'filters', id: '1' }],
            query: '',
          }
        )
      ).toEqual(undefined);
    });

    it('returns logs samples for time series queries', () => {
      expect(
        ds.getSupplementaryQuery(
          { type: SupplementaryQueryType.LogsSample, limit: 100 },
          {
            refId: 'A',
            query: '',
            bucketAggs: [{ type: 'date_histogram', id: '1' }],
          }
        )
      ).toEqual({
        refId: `log-sample-A`,
        query: '',
        metrics: [{ type: 'logs', id: '1', settings: { limit: '100' } }],
      });
    });

    it('does not return logs samples for hidden time series queries', () => {
      expect(
        ds.getSupplementaryQuery(
          { type: SupplementaryQueryType.LogsSample, limit: 100 },
          {
            refId: 'A',
            query: '',
            bucketAggs: [{ type: 'date_histogram', id: '1' }],
            hide: true,
          }
        )
      ).toEqual(undefined);
    });
  });

  describe('getDataProvider', () => {
    it('does not create a logs sample provider for non time series query', () => {
      const options: DataQueryRequest<ElasticsearchQuery> = {
        ...dataQueryDefaults,
        targets: [
          {
            refId: 'A',
            metrics: [{ type: 'logs', id: '1', settings: { limit: '100' } }],
          },
        ],
      };

      expect(ds.getSupplementaryRequest(SupplementaryQueryType.LogsSample, options)).not.toBeDefined();
    });

    it('does not create a logs volume provider for hidden queries', () => {
      const options: DataQueryRequest<ElasticsearchQuery> = {
        ...dataQueryDefaults,
        targets: [
          {
            refId: 'A',
            metrics: [{ type: 'logs', id: '1', settings: { limit: '100' } }],
            hide: true,
          },
        ],
      };

      expect(ds.getSupplementaryRequest(SupplementaryQueryType.LogsVolume, options)).not.toBeDefined();
    });

    it('does create a logs sample provider for time series query', () => {
      const options: DataQueryRequest<ElasticsearchQuery> = {
        ...dataQueryDefaults,
        targets: [
          {
            refId: 'A',
            bucketAggs: [{ type: 'date_histogram', id: '1' }],
          },
        ],
      };

      expect(ds.getSupplementaryRequest(SupplementaryQueryType.LogsSample, options)).toBeDefined();
    });
  });

  describe('getLogsSampleDataProvider', () => {
    it("doesn't return a logs sample provider given a non time series query", () => {
      const request: DataQueryRequest<ElasticsearchQuery> = {
        ...dataQueryDefaults,
        targets: [
          {
            refId: 'A',
            metrics: [{ type: 'logs', id: '1', settings: { limit: '100' } }],
          },
        ],
      };

      expect(ds.getSupplementaryRequest(SupplementaryQueryType.LogsSample, request)).not.toBeDefined();
    });

    it('returns a logs sample provider given a time series query', () => {
      const request: DataQueryRequest<ElasticsearchQuery> = {
        ...dataQueryDefaults,
        targets: [
          {
            refId: 'A',
            bucketAggs: [{ type: 'date_histogram', id: '1' }],
          },
        ],
      };

      expect(ds.getSupplementaryRequest(SupplementaryQueryType.LogsSample, request)).toBeDefined();
    });
  });

  describe('getMultiSearchUrl', () => {
    it('Should add correct params to URL if "includeFrozen" is enabled', () => {
      const ds = createElasticDatasource({ jsonData: { includeFrozen: true } });
      expect(ds.getMultiSearchUrl()).toMatch(/ignore_throttled=false/);
    });

    it('Should NOT add ignore_throttled if "includeFrozen" is disabled', () => {
      const ds = createElasticDatasource({ jsonData: { includeFrozen: false } });
      expect(ds.getMultiSearchUrl()).not.toMatch(/ignore_throttled=false/);
    });
  });

  describe('modifyQuery', () => {
    let query: ElasticsearchQuery;
    beforeEach(() => {
      query = { query: '', refId: 'A' };
    });
    describe('with empty query', () => {
      describe('ADD_FILTER and ADD_FILTER_OUT', () => {
        it('should add the filter', () => {
          expect(ds.modifyQuery(query, { type: 'ADD_FILTER', options: { key: 'foo', value: 'bar' } }).query).toBe(
            'foo:"bar"'
          );
        });

        it('should add the negative filter', () => {
          expect(ds.modifyQuery(query, { type: 'ADD_FILTER_OUT', options: { key: 'foo', value: 'bar' } }).query).toBe(
            '-foo:"bar"'
          );
        });

        it('should do nothing on unknown type', () => {
          expect(ds.modifyQuery(query, { type: 'unknown', options: { key: 'foo', value: 'bar' } }).query).toBe(
            query.query
          );
        });
      });

      describe('with non-empty query', () => {
        let query: ElasticsearchQuery;
        beforeEach(() => {
          query = { query: 'test:"value"', refId: 'A' };
        });

        it('should add the filter', () => {
          expect(ds.modifyQuery(query, { type: 'ADD_FILTER', options: { key: 'foo', value: 'bar' } }).query).toBe(
            'test:"value" AND foo:"bar"'
          );
        });

        it('should add the negative filter', () => {
          expect(ds.modifyQuery(query, { type: 'ADD_FILTER_OUT', options: { key: 'foo', value: 'bar' } }).query).toBe(
            'test:"value" AND -foo:"bar"'
          );
        });

        it('should do nothing on unknown type', () => {
          expect(ds.modifyQuery(query, { type: 'unknown', options: { key: 'foo', value: 'bar' } }).query).toBe(
            query.query
          );
        });
      });
    });

    describe('ADD_STRING_FILTER and ADD_STRING_FILTER_OUT', () => {
      beforeEach(() => {
        query = { query: '', refId: 'A' };
      });

      it('should add the filter', () => {
        expect(ds.modifyQuery(query, { type: 'ADD_STRING_FILTER', options: { value: 'bar' } }).query).toBe('"bar"');
      });

      it('should add the negative filter', () => {
        expect(ds.modifyQuery(query, { type: 'ADD_STRING_FILTER_OUT', options: { value: 'bar' } }).query).toBe(
          'NOT "bar"'
        );
      });
    });

    describe('with non-empty query', () => {
      let query: ElasticsearchQuery;
      beforeEach(() => {
        query = { query: 'test:"value"', refId: 'A' };
      });

      it('should add the filter', () => {
        expect(ds.modifyQuery(query, { type: 'ADD_STRING_FILTER', options: { value: 'bar' } }).query).toBe(
          'test:"value" AND "bar"'
        );
      });

      it('should add the negative filter', () => {
        expect(ds.modifyQuery(query, { type: 'ADD_STRING_FILTER_OUT', options: { value: 'bar' } }).query).toBe(
          'test:"value" NOT "bar"'
        );
      });
    });

    describe('toggleQueryFilter', () => {
      describe('with empty query', () => {
        let query: ElasticsearchQuery;
        beforeEach(() => {
          query = { query: '', refId: 'A' };
        });

        it('should add the filter', () => {
          expect(ds.toggleQueryFilter(query, { type: 'FILTER_FOR', options: { key: 'foo', value: 'bar' } }).query).toBe(
            'foo:"bar"'
          );
        });

        it('should toggle the filter', () => {
          query.query = 'foo:"bar"';
          expect(ds.toggleQueryFilter(query, { type: 'FILTER_FOR', options: { key: 'foo', value: 'bar' } }).query).toBe(
            ''
          );
        });

        it('should add the negative filter', () => {
          expect(ds.toggleQueryFilter(query, { type: 'FILTER_OUT', options: { key: 'foo', value: 'bar' } }).query).toBe(
            '-foo:"bar"'
          );
        });

        it('should remove a positive filter to add a negative filter', () => {
          query.query = 'foo:"bar"';
          expect(ds.toggleQueryFilter(query, { type: 'FILTER_OUT', options: { key: 'foo', value: 'bar' } }).query).toBe(
            '-foo:"bar"'
          );
        });
      });

      describe('with non-empty query', () => {
        let query: ElasticsearchQuery;
        beforeEach(() => {
          query = { query: 'test:"value"', refId: 'A' };
        });

        it('should add the filter', () => {
          expect(ds.toggleQueryFilter(query, { type: 'FILTER_FOR', options: { key: 'foo', value: 'bar' } }).query).toBe(
            'test:"value" AND foo:"bar"'
          );
        });

        it('should add the negative filter', () => {
          expect(ds.toggleQueryFilter(query, { type: 'FILTER_OUT', options: { key: 'foo', value: 'bar' } }).query).toBe(
            'test:"value" AND -foo:"bar"'
          );
        });
      });
    });

    describe('queryHasFilter()', () => {
      it('inspects queries for filter presence', () => {
        const query = { refId: 'A', query: 'grafana:"awesome"' };
        expect(
          ds.queryHasFilter(query, {
            key: 'grafana',
            value: 'awesome',
          })
        ).toBe(true);
      });
    });

    describe('addAdhocFilters', () => {
      describe('with invalid filters', () => {
        it('should filter out ad hoc filter without key', () => {
          const query = ds.addAdHocFilters('foo:"bar"', [{ key: '', operator: '=', value: 'a', condition: '' }]);
          expect(query).toBe('foo:"bar"');
        });

        it('should filter out ad hoc filter without value', () => {
          const query = ds.addAdHocFilters('foo:"bar"', [{ key: 'a', operator: '=', value: '', condition: '' }]);
          expect(query).toBe('foo:"bar"');
        });

        it('should filter out filter ad hoc filter with invalid operator', () => {
          const query = ds.addAdHocFilters('foo:"bar"', [{ key: 'a', operator: 'A', value: '', condition: '' }]);
          expect(query).toBe('foo:"bar"');
        });
      });

      describe('with 1 ad hoc filter', () => {
        it('should correctly add 1 ad hoc filter when query is not empty', () => {
          const filters = [{ key: 'test', operator: '=', value: 'test1', condition: '' }];
          const query = ds.addAdHocFilters('foo:"bar"', filters);
          expect(query).toBe('foo:"bar" AND test:"test1"');
        });

        it('should correctly add 1 ad hoc filter when query is empty', () => {
          const filters = [{ key: 'test', operator: '=', value: 'test1', condition: '' }];
          expect(ds.addAdHocFilters('', filters)).toBe('test:"test1"');
          expect(ds.addAdHocFilters(' ', filters)).toBe('test:"test1"');
          expect(ds.addAdHocFilters('  ', filters)).toBe('test:"test1"');
        });

        it('should not fail if the filter value is a number', () => {
          // @ts-expect-error
          expect(ds.addAdHocFilters('', [{ key: 'key', operator: '=', value: 1, condition: '' }])).toBe('key:"1"');
        });

        it.each(['=', '!=', '=~', '!~', '>', '<', '', ''])(
          `should properly build queries with '%s' filters`,
          (operator: string) => {
            const filters = [{ key: 'key', operator, value: 'value', condition: '' }];
            const query = ds.addAdHocFilters('foo:"bar"', filters);

            switch (operator) {
              case '=':
                expect(query).toBe('foo:"bar" AND key:"value"');
                break;
              case '!=':
                expect(query).toBe('foo:"bar" AND -key:"value"');
                break;
              case '=~':
                expect(query).toBe('foo:"bar" AND key:/value/');
                break;
              case '!~':
                expect(query).toBe('foo:"bar" AND -key:/value/');
                break;
              case '>':
                expect(query).toBe('foo:"bar" AND key:>value');
                break;
              case '<':
                expect(query).toBe('foo:"bar" AND key:<value');
                break;
            }
          }
        );

        it('should escape characters in filter keys', () => {
          const filters = [{ key: 'field:name', operator: '=', value: 'field:value', condition: '' }];
          const query = ds.addAdHocFilters('', filters);
          expect(query).toBe('field\\:name:"field:value"');
        });

        it('should escape characters in filter values', () => {
          const filters = [{ key: 'field:name', operator: '=', value: 'field "value"', condition: '' }];
          const query = ds.addAdHocFilters('', filters);
          expect(query).toBe('field\\:name:"field \\"value\\""');
        });

        it('should not escape backslash in regex', () => {
          const filters = [{ key: 'field:name', operator: '=~', value: 'field value\\/', condition: '' }];
          const query = ds.addAdHocFilters('', filters);
          expect(query).toBe('field\\:name:/field value\\//');
        });

        it('should replace level with the log level field', () => {
          const ds = createElasticDatasource({ jsonData: { logLevelField: 'level_field' } });
          const filters = [{ key: 'level', operator: '=', value: 'foo', condition: '' }];
          const query = ds.addAdHocFilters('', filters);
          expect(query).toBe('level_field:"foo"');
        });
      });
    });

    describe('with multiple ad hoc filters', () => {
      const filters = [
        { key: 'bar', operator: '=', value: 'baz', condition: '' },
        { key: 'job', operator: '!=', value: 'grafana', condition: '' },
        { key: 'service', operator: '=~', value: 'service', condition: '' },
        { key: 'count', operator: '>', value: '1', condition: '' },
      ];
      it('should correctly add ad hoc filters when query is not empty', () => {
        const query = ds.addAdHocFilters('foo:"bar" AND test:"test1"', filters);
        expect(query).toBe(
          'foo:"bar" AND test:"test1" AND bar:"baz" AND -job:"grafana" AND service:/service/ AND count:>1'
        );
      });

      it('should correctly add ad hoc filters when query is  empty', () => {
        const query = ds.addAdHocFilters('', filters);
        expect(query).toBe('bar:"baz" AND -job:"grafana" AND service:/service/ AND count:>1');
      });
    });
  });

  describe('targetContainsTemplate', () => {
    let target: ElasticsearchQuery;
    beforeEach(() => {
      target = {
        refId: 'test',
        bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '1' }],
        metrics: [{ type: 'count', id: '1' }],
        query: 'escape\\:test',
      };
    });
    it('returns false when there is no variable in the query', () => {
      expect(ds.targetContainsTemplate(target)).toBe(false);
    });
    it('returns true when there are variables in the query alias', () => {
      target.alias = '$variable';
      expect(ds.targetContainsTemplate(target)).toBe(true);
    });
    it('returns true when there are variables in the query', () => {
      target.query = '$variable:something';
      expect(ds.targetContainsTemplate(target)).toBe(true);
    });
    it('returns true when there are variables in the bucket aggregation', () => {
      target.bucketAggs = [{ type: 'date_histogram', field: '$field', id: '1' }];
      expect(ds.targetContainsTemplate(target)).toBe(true);
      target.bucketAggs = [
        { type: 'date_histogram', field: '@timestamp', id: '1', settings: { interval: '$interval' } },
      ];
      expect(ds.targetContainsTemplate(target)).toBe(true);
    });
    it('returns true when there are variables in the metric aggregation', () => {
      target.metrics = [{ type: 'moving_avg', id: '1', settings: { window: '$window' } }];
      expect(ds.targetContainsTemplate(target)).toBe(true);
      target.metrics = [{ type: 'moving_avg', id: '1', field: '$field' }];
      expect(ds.targetContainsTemplate(target)).toBe(true);
      target.metrics = [{ type: 'extended_stats', id: '1', meta: { something: '$something' } }];
      expect(ds.targetContainsTemplate(target)).toBe(true);
    });
    it('returns true when there are variables in an array inside an object in metrics', () => {
      target.metrics = [
        {
          field: 'counter',
          id: '1',
          settings: { percents: ['20', '40', '$qqq'] },
          type: 'percentiles',
        },
      ];
      expect(ds.targetContainsTemplate(target)).toBe(true);
    });
  });

  describe('annotationQuery', () => {
    describe('results processing', () => {
      it('should return simple annotations using defaults', async () => {
        ds.postResourceRequest = jest.fn().mockResolvedValue({
          responses: [
            {
              hits: {
                hits: [
                  { _source: { '@timestamp': 1, '@test_tags': 'foo', text: 'abc' } },
                  { _source: { '@timestamp': 3, '@test_tags': 'bar', text: 'def' } },
                ],
              },
            },
          ],
        });

        const annotations = await ds.annotationQuery({
          annotation: {},
          dashboard: {
            getVariables: () => [],
          },
          range: {
            from: 1,
            to: 2,
          },
        });

        expect(annotations).toHaveLength(2);
        expect(annotations[0].time).toBe(1);
        expect(annotations[1].time).toBe(3);
      });

      it('should return annotation events using options', async () => {
        ds.postResourceRequest = jest.fn().mockResolvedValue({
          responses: [
            {
              hits: {
                hits: [
                  { _source: { '@test_time': 1, '@test_tags': 'foo', text: 'abc' } },
                  { _source: { '@test_time': 3, '@test_tags': 'bar', text: 'def' } },
                ],
              },
            },
          ],
        });

        const annotations = await ds.annotationQuery({
          annotation: {
            timeField: '@test_time',
            name: 'foo',
            query: 'abc',
            tagsField: '@test_tags',
            textField: 'text',
          },
          dashboard: {
            getVariables: () => [],
          },
          range: {
            from: 1,
            to: 2,
          },
        });
        expect(annotations).toHaveLength(2);
        expect(annotations[0].time).toBe(1);
        expect(annotations[0].tags?.[0]).toBe('foo');
        expect(annotations[0].text).toBe('abc');

        expect(annotations[1].time).toBe(3);
        expect(annotations[1].tags?.[0]).toBe('bar');
        expect(annotations[1].text).toBe('def');
      });
    });

    describe('request processing', () => {
      it('should process annotation request using options', async () => {
        const postResourceRequestMock = jest.spyOn(ds, 'postResourceRequest').mockResolvedValue({
          responses: [
            {
              hits: {
                hits: [
                  { _source: { '@test_time': 1, '@test_tags': 'foo', text: 'abc' } },
                  { _source: { '@test_time': 3, '@test_tags': 'bar', text: 'def' } },
                ],
              },
            },
          ],
        });

        await ds.annotationQuery({
          annotation: {
            timeField: '@test_time',
            timeEndField: '@time_end_field',
            name: 'foo',
            query: 'abc',
            tagsField: '@test_tags',
            textField: 'text',
          },
          dashboard: {
            getVariables: () => [],
          },
          range: {
            from: dateTime(1683291160012),
            to: dateTime(1683291460012),
          },
        });
        expect(postResourceRequestMock).toHaveBeenCalledWith(
          '_msearch',
          '{"search_type":"query_then_fetch","ignore_unavailable":true,"index":"[test-]YYYY.MM.DD"}\n{"query":{"bool":{"filter":[{"bool":{"should":[{"range":{"@test_time":{"from":1683291160012,"to":1683291460012,"format":"epoch_millis"}}},{"range":{"@time_end_field":{"from":1683291160012,"to":1683291460012,"format":"epoch_millis"}}}],"minimum_should_match":1}},{"query_string":{"query":"abc"}}]}},"size":10000}\n'
        );
      });

      it('should process annotation request using defaults', async () => {
        const postResourceRequestMock = jest.spyOn(ds, 'postResourceRequest').mockResolvedValue({
          responses: [
            {
              hits: {
                hits: [
                  { _source: { '@test_time': 1, '@test_tags': 'foo', text: 'abc' } },
                  { _source: { '@test_time': 3, '@test_tags': 'bar', text: 'def' } },
                ],
              },
            },
          ],
        });

        await ds.annotationQuery({
          annotation: {},
          dashboard: {
            getVariables: () => [],
          },
          range: {
            from: dateTime(1683291160012),
            to: dateTime(1683291460012),
          },
        });
        expect(postResourceRequestMock).toHaveBeenCalledWith(
          '_msearch',
          '{"search_type":"query_then_fetch","ignore_unavailable":true,"index":"[test-]YYYY.MM.DD"}\n{"query":{"bool":{"filter":[{"bool":{"should":[{"range":{"@timestamp":{"from":1683291160012,"to":1683291460012,"format":"epoch_millis"}}}],"minimum_should_match":1}}]}},"size":10000}\n'
        );
      });

      it('should process annotation request using dashboard adhoc variables', async () => {
        const ds = createElasticDatasource();
        const postResourceRequestMock = jest.spyOn(ds, 'postResourceRequest').mockResolvedValue({
          responses: [
            {
              hits: {
                hits: [
                  { _source: { '@test_time': 1, '@test_tags': 'foo', text: 'abc' } },
                  { _source: { '@test_time': 3, '@test_tags': 'bar', text: 'def' } },
                ],
              },
            },
          ],
        });

        await ds.annotationQuery({
          annotation: {
            timeField: '@test_time',
            timeEndField: '@time_end_field',
            name: 'foo',
            query: 'abc',
            tagsField: '@test_tags',
            textField: 'text',
            datasource: {
              type: 'elasticsearch',
              uid: 'gdev-elasticsearch',
            },
          },
          dashboard: {
            getVariables: () => [
              {
                type: 'adhoc',
                datasource: {
                  type: 'elasticsearch',
                  uid: 'gdev-elasticsearch',
                },
                filters: [
                  {
                    key: 'abc_key',
                    operator: '=',
                    value: 'abc_value',
                  },
                ],
              },
            ],
          },
          range: {
            from: dateTime(1683291160012),
            to: dateTime(1683291460012),
          },
        });
        expect(postResourceRequestMock).toHaveBeenCalledWith(
          '_msearch',
          '{"search_type":"query_then_fetch","ignore_unavailable":true,"index":"[test-]YYYY.MM.DD"}\n{"query":{"bool":{"filter":[{"bool":{"should":[{"range":{"@test_time":{"from":1683291160012,"to":1683291460012,"format":"epoch_millis"}}},{"range":{"@time_end_field":{"from":1683291160012,"to":1683291460012,"format":"epoch_millis"}}}],"minimum_should_match":1}},{"query_string":{"query":"abc AND abc_key:\\"abc_value\\""}}]}},"size":10000}\n'
        );
      });
    });
  });

  describe('getDatabaseVersion', () => {
    it('should correctly get db version', async () => {
      ds.getResource = jest.fn().mockResolvedValue({ version: { number: '8.0.0' } });
      const version = await ds.getDatabaseVersion();
      expect(version?.raw).toBe('8.0.0');
    });

    it('should correctly return null if invalid numeric version', async () => {
      ds.getResource = jest.fn().mockResolvedValue({ version: { number: 8 } });
      const version = await ds.getDatabaseVersion();
      expect(version).toBe(null);
    });

    it('should correctly return null if rejected request', async () => {
      ds.getResource = jest.fn().mockRejectedValue({});
      const version = await ds.getDatabaseVersion();
      expect(version).toBe(null);
    });
  });

  describe('metricFindQuery', () => {
    async function runScenario() {
      const data = {
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
                  {
                    doc_count: 2,
                    key: 5,
                  },
                ],
              },
            },
          },
        ],
      };

      const ds = createElasticDatasource();
      const postResourceMock = jest.spyOn(ds, 'postResource');
      postResourceMock.mockResolvedValue(data);

      const results = await ds.metricFindQuery('{"find": "terms", "field": "test"}');

      expect(ds.postResource).toHaveBeenCalledTimes(1);
      const requestOptions = postResourceMock.mock.calls[0][1];
      const parts = requestOptions.split('\n');
      const header = JSON.parse(parts[0]);
      const body = JSON.parse(parts[1]);

      return { results, body, header };
    }

    it('should get results', async () => {
      const { results } = await runScenario();
      expect(results.length).toEqual(3);
    });

    it('should use key, key_as_string, or cast key to string', async () => {
      const { results } = await runScenario();
      expect(results[0].text).toEqual('test');
      expect(results[1].text).toEqual('test2_as_string');
      expect(results[2].text).toEqual('5');
    });

    it('should not set search type to count', async () => {
      const { header } = await runScenario();
      expect(header.search_type).not.toEqual('count');
    });

    it('should set size to 0', async () => {
      const { body } = await runScenario();
      expect(body.size).toBe(0);
    });

    it('should not set terms aggregation size to 0', async () => {
      const { body } = await runScenario();
      expect(body['aggs']['1']['terms'].size).not.toBe(0);
    });
  });

  describe('getFields', () => {
    const getFieldsMockData = {
      '[test-]YYYY.MM.DD': {
        mappings: {
          properties: {
            '@timestamp_millis': {
              type: 'date',
              format: 'epoch_millis',
            },
            classification_terms: {
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
          },
        },
      },
    };

    it('should not retry when ES is down', async () => {
      const twoDaysBefore = toUtc().subtract(2, 'day').format('YYYY.MM.DD');
      const ds = createElasticDatasource({
        jsonData: { interval: 'Daily' },
      });

      ds.getResource = jest.fn().mockImplementation((options) => {
        if (options.url === `test-${twoDaysBefore}/_mapping`) {
          return of({
            data: {},
          });
        }
        return throwError({ status: 500 });
      });

      const timeRange = { from: 1, to: 2 } as unknown as TimeRange;
      await expect(ds.getFields(undefined, timeRange)).toEmitValuesWith((received) => {
        expect(received.length).toBe(1);
        expect(received[0]).toStrictEqual({ status: 500 });
        expect(ds.getResource).toBeCalledTimes(1);
      });
    });

    it('should not retry more than 7 indices', async () => {
      const ds = createElasticDatasource({
        jsonData: { interval: 'Daily' },
      });

      ds.getResource = jest.fn().mockImplementation(() => {
        return throwError({ status: 404 });
      });

      const timeRange = createTimeRange(dateTime().subtract(2, 'week'), dateTime());

      await expect(ds.getFields(undefined, timeRange)).toEmitValuesWith((received) => {
        expect(received.length).toBe(1);
        expect(received[0]).toStrictEqual('Could not find an available index for this time range.');
        expect(ds.getResource).toBeCalledTimes(7);
      });
    });

    it('should return nested fields', async () => {
      const ds = createElasticDatasource({
        jsonData: { interval: 'Daily' },
      });

      ds.getResource = jest.fn().mockResolvedValue(getFieldsMockData);

      await expect(ds.getFields()).toEmitValuesWith((received) => {
        expect(received.length).toBe(1);

        const fieldObjects = received[0];
        const fields = map(fieldObjects, 'text');
        expect(fields).toEqual([
          '@timestamp_millis',
          'classification_terms',
          'ip_address',
          'justification_blob.criterion.keyword',
          'justification_blob.criterion',
          'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.botness',
          'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.general_algorithm_score',
          'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.botness',
          'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.general_algorithm_score',
          'overall_vote_score',
        ]);
      });
    });
    it('should return number fields', async () => {
      ds.getResource = jest.fn().mockResolvedValue(getFieldsMockData);

      await expect(ds.getFields(['number'])).toEmitValuesWith((received) => {
        expect(received.length).toBe(1);

        const fieldObjects = received[0];
        const fields = map(fieldObjects, 'text');
        expect(fields).toEqual([
          'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.botness',
          'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.general_algorithm_score',
          'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.botness',
          'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.general_algorithm_score',
          'overall_vote_score',
        ]);
      });
    });

    it('should return date fields', async () => {
      ds.getResource = jest.fn().mockResolvedValue(getFieldsMockData);

      await expect(ds.getFields(['date'])).toEmitValuesWith((received) => {
        expect(received.length).toBe(1);

        const fieldObjects = received[0];
        const fields = map(fieldObjects, 'text');
        expect(fields).toEqual(['@timestamp_millis']);
      });
    });
  });

  describe('getFieldsFieldCap', () => {
    const originalFeatureToggleValue = config.featureToggles.elasticsearchCrossClusterSearch;

    afterEach(() => {
      config.featureToggles.elasticsearchCrossClusterSearch = originalFeatureToggleValue;
    });
    const getFieldsMockData = {
      fields: {
        '@timestamp_millis': {
          date: {
            type: 'date',
            metadata_field: false,
          },
        },
        classification_terms: {
          keyword: {
            type: 'keyword',
            metadata_field: false,
          },
        },
        ip_address: {
          ip: {
            type: 'ip',
            metadata_field: false,
          },
        },
        'justification_blob.criterion.keyword': {
          keyword: {
            type: 'keyword',
            metadata_field: false,
          },
        },
        'justification_blob.criterion': {
          text: {
            type: 'text',
            metadata_field: false,
          },
        },
        justification_blob: {
          object: {
            type: 'object',
            metadata_field: false,
          },
        },
        'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.botness': {
          float: {
            type: 'float',
            metadata_field: false,
          },
        },
        'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.general_algorithm_score': {
          float: {
            type: 'float',
            metadata_field: false,
          },
        },
        'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.botness': {
          float: {
            type: 'float',
            metadata_field: false,
          },
        },
        'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.general_algorithm_score': {
          float: {
            type: 'float',
            metadata_field: false,
          },
        },
        overall_vote_score: {
          float: {
            type: 'float',
            metadata_field: false,
          },
        },
        _index: {
          _index: {
            type: '_index',
            metadata_field: true,
          },
        },
      },
      indices: ['[test-]YYYY.MM.DD'],
    };

    it('should not retry when ES is down', async () => {
      config.featureToggles.elasticsearchCrossClusterSearch = true;
      const twoDaysBefore = toUtc().subtract(2, 'day').format('YYYY.MM.DD');
      const ds = createElasticDatasource({
        jsonData: { interval: 'Daily' },
      });

      ds.getResource = jest.fn().mockImplementation((options) => {
        if (options.url === `test-${twoDaysBefore}/_field_caps`) {
          return of({
            data: {},
          });
        }
        return throwError({ status: 500 });
      });

      const timeRange = { from: 1, to: 2 } as unknown as TimeRange;
      await expect(ds.getFields(undefined, timeRange)).toEmitValuesWith((received) => {
        expect(received.length).toBe(1);
        expect(received[0]).toStrictEqual({ status: 500 });
        expect(ds.getResource).toBeCalledTimes(1);
      });
    });

    it('should not retry more than 7 indices', async () => {
      config.featureToggles.elasticsearchCrossClusterSearch = true;
      const ds = createElasticDatasource({
        jsonData: { interval: 'Daily' },
      });

      ds.getResource = jest.fn().mockImplementation(() => {
        return throwError({ status: 404 });
      });

      const timeRange = createTimeRange(dateTime().subtract(2, 'week'), dateTime());

      await expect(ds.getFields(undefined, timeRange)).toEmitValuesWith((received) => {
        expect(received.length).toBe(1);
        expect(received[0]).toStrictEqual('Could not find an available index for this time range.');
        expect(ds.getResource).toBeCalledTimes(7);
      });
    });

    it('should return nested fields', async () => {
      config.featureToggles.elasticsearchCrossClusterSearch = true;
      const ds = createElasticDatasource({
        jsonData: { interval: 'Daily' },
      });

      ds.getResource = jest.fn().mockResolvedValue(getFieldsMockData);

      await expect(ds.getFields()).toEmitValuesWith((received) => {
        expect(received.length).toBe(1);

        const fieldObjects = received[0];
        const fields = map(fieldObjects, 'text');
        expect(fields).toEqual([
          '@timestamp_millis',
          'classification_terms',
          'ip_address',
          'justification_blob.criterion.keyword',
          'justification_blob.criterion',
          'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.botness',
          'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.general_algorithm_score',
          'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.botness',
          'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.general_algorithm_score',
          'overall_vote_score',
        ]);
      });
    });
    it('should return number fields', async () => {
      config.featureToggles.elasticsearchCrossClusterSearch = true;
      ds.getResource = jest.fn().mockResolvedValue(getFieldsMockData);

      await expect(ds.getFields(['number'])).toEmitValuesWith((received) => {
        expect(received.length).toBe(1);

        const fieldObjects = received[0];
        const fields = map(fieldObjects, 'text');
        expect(fields).toEqual([
          'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.botness',
          'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.general_algorithm_score',
          'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.botness',
          'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.general_algorithm_score',
          'overall_vote_score',
        ]);
      });
    });

    it('should return date fields', async () => {
      config.featureToggles.elasticsearchCrossClusterSearch = true;
      ds.getResource = jest.fn().mockResolvedValue(getFieldsMockData);

      await expect(ds.getFields(['date'])).toEmitValuesWith((received) => {
        expect(received.length).toBe(1);

        const fieldObjects = received[0];
        const fields = map(fieldObjects, 'text');
        expect(fields).toEqual(['@timestamp_millis']);
      });
    });
  });
});
