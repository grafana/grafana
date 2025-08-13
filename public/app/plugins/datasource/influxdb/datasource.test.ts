import { lastValueFrom, of } from 'rxjs';

import { AdHocVariableFilter } from '@grafana/data';
import { BackendSrvRequest, TemplateSrv } from '@grafana/runtime';
import config from 'app/core/config';

import { queryBuilder } from '../../../features/variables/shared/testing/builders';

import { BROWSER_MODE_DISABLED_MESSAGE } from './constants';
import InfluxDatasource from './datasource';
import { getMockDSInstanceSettings, getMockInfluxDS, mockBackendService, replaceMock } from './mocks/datasource';
import { mockInfluxQueryRequest } from './mocks/request';
import { mockInfluxFetchResponse, mockMetricFindQueryResponse } from './mocks/response';
import { InfluxQuery, InfluxVersion } from './types';

const fetchMock = mockBackendService(mockInfluxFetchResponse());

describe('datasource initialization', () => {
  it('should read the http method from jsonData', () => {
    let ds = getMockInfluxDS(getMockDSInstanceSettings({ httpMode: 'GET' }));
    expect(ds.httpMode).toBe('GET');
    ds = getMockInfluxDS(getMockDSInstanceSettings({ httpMode: 'POST' }));
    expect(ds.httpMode).toBe('POST');
  });
});

// Remove this suite when influxdbBackendMigration feature toggle removed
describe('InfluxDataSource Frontend Mode [influxdbBackendMigration=false]', () => {
  beforeEach(() => {
    // we want only frontend mode in this suite
    config.featureToggles.influxdbBackendMigration = false;
    jest.clearAllMocks();
  });

  describe('general checks', () => {
    it('should throw an error if there is 200 response with error', async () => {
      const ds = getMockInfluxDS();
      fetchMock.mockImplementation(() => {
        return of({
          data: {
            results: [
              {
                error: 'Query timeout',
              },
            ],
          },
        });
      });

      try {
        await lastValueFrom(ds.query(mockInfluxQueryRequest()));
      } catch (err) {
        if (err instanceof Error) {
          expect(err.message).toBe('InfluxDB Error: Query timeout');
        }
      }
    });

    it('should throw an error when querying data when deprecated access mode', async () => {
      expect.assertions(1);
      const instanceSettings = getMockDSInstanceSettings();
      instanceSettings.access = 'direct';
      const ds = getMockInfluxDS(instanceSettings);
      try {
        await lastValueFrom(ds.query(mockInfluxQueryRequest()));
      } catch (err) {
        if (err instanceof Error) {
          expect(err.message).toBe(BROWSER_MODE_DISABLED_MESSAGE);
        }
      }
    });
  });

  describe('metricFindQuery', () => {
    let ds: InfluxDatasource;
    const query = 'SELECT max(value) FROM measurement WHERE $timeFilter';
    const queryOptions = {
      range: {
        from: '2018-01-01T00:00:00Z',
        to: '2018-01-02T00:00:00Z',
      },
    };
    const fetchMockImpl = (req: BackendSrvRequest) => {
      return of({
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
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      fetchMock.mockImplementation(fetchMockImpl);
    });

    it('should replace $timefilter', async () => {
      ds = getMockInfluxDS(getMockDSInstanceSettings({ httpMode: 'GET' }));
      await ds.metricFindQuery({ refId: 'test', query }, queryOptions);
      expect(fetchMock.mock.lastCall[0].params?.q).toMatch('time >= 1514764800000ms and time <= 1514851200000ms');
      ds = getMockInfluxDS(getMockDSInstanceSettings({ httpMode: 'POST' }));
      await ds.metricFindQuery({ refId: 'test', query }, queryOptions);
      expect(fetchMock.mock.lastCall[0].params?.q).toBeFalsy();
      expect(fetchMock.mock.lastCall[0].data).toMatch(
        'time%20%3E%3D%201514764800000ms%20and%20time%20%3C%3D%201514851200000ms'
      );
    });

    it('should not have any data in request body if http mode is GET', async () => {
      ds = getMockInfluxDS(getMockDSInstanceSettings({ httpMode: 'GET' }));
      await ds.metricFindQuery({ refId: 'test', query }, queryOptions);
      expect(fetchMock.mock.lastCall[0].data).toBeNull();
    });

    it('should have data in request body if http mode is POST', async () => {
      ds = getMockInfluxDS(getMockDSInstanceSettings({ httpMode: 'POST' }));
      await ds.metricFindQuery({ refId: 'test', query }, queryOptions);
      expect(fetchMock.mock.lastCall[0].data).not.toBeNull();
      expect(fetchMock.mock.lastCall[0].data).toMatch('q=SELECT');
    });

    it('parse response correctly', async () => {
      ds = getMockInfluxDS(getMockDSInstanceSettings({ httpMode: 'GET' }));
      let responseGet = await ds.metricFindQuery({ refId: 'test', query }, queryOptions);
      expect(responseGet).toEqual([{ text: 'cpu' }]);
      ds = getMockInfluxDS(getMockDSInstanceSettings({ httpMode: 'POST' }));
      let responsePost = await ds.metricFindQuery({ refId: 'test', query }, queryOptions);
      expect(responsePost).toEqual([{ text: 'cpu' }]);
    });
  });

  // Update this after starting to use TemplateSrv from @grafana/runtime package
  describe('adhoc variables', () => {
    let ds = getMockInfluxDS(getMockDSInstanceSettings());

    it('query should contain the ad-hoc variable', () => {
      ds.query(mockInfluxQueryRequest());
      expect(replaceMock.mock.calls[0][0]).toBe('adhoc_val');
    });

    it('should make the fetch call for adhoc filter keys', () => {
      fetchMock.mockReturnValue(
        of({
          results: [
            {
              statement_id: 0,
              series: [
                {
                  name: 'cpu',
                  columns: ['tagKey'],
                  values: [['datacenter'], ['geohash'], ['source']],
                },
              ],
            },
          ],
        })
      );
      ds.getTagKeys();
      expect(fetchMock).toHaveBeenCalled();
      const fetchReq = fetchMock.mock.calls[0][0];
      expect(fetchReq).not.toBeNull();
      expect(fetchReq.data).toMatch(encodeURIComponent(`SHOW TAG KEYS`));
    });

    it('should make the fetch call for adhoc filter values', () => {
      fetchMock.mockReturnValue(
        of({
          results: [
            {
              statement_id: 0,
              series: [
                {
                  name: 'mykey',
                  columns: ['key', 'value'],
                  values: [['mykey', 'value']],
                },
              ],
            },
          ],
        })
      );
      ds.getTagValues({ key: 'mykey', filters: [] });
      expect(fetchMock).toHaveBeenCalled();
      const fetchReq = fetchMock.mock.calls[0][0];
      expect(fetchReq).not.toBeNull();
      expect(fetchReq.data).toMatch(encodeURIComponent(`SHOW TAG VALUES WITH KEY = "mykey"`));
    });
  });

  describe('datasource contract', () => {
    let ds: InfluxDatasource;
    const metricFindQueryMock = jest.fn();
    beforeEach(() => {
      jest.clearAllMocks();
      ds = getMockInfluxDS();
      ds.metricFindQuery = metricFindQueryMock;
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should check the datasource has "getTagKeys" function defined', () => {
      expect(Object.getOwnPropertyNames(Object.getPrototypeOf(ds))).toContain('getTagKeys');
    });

    it('should check the datasource has "getTagValues" function defined', () => {
      expect(Object.getOwnPropertyNames(Object.getPrototypeOf(ds))).toContain('getTagValues');
    });

    it('should be able to call getTagKeys without specifying any parameter', () => {
      ds.getTagKeys();
      expect(metricFindQueryMock).toHaveBeenCalled();
    });

    it('should be able to call getTagValues without specifying anything but key', () => {
      ds.getTagValues({ key: 'test', filters: [] });
      expect(metricFindQueryMock).toHaveBeenCalled();
    });

    it('should use dbName instead of database', () => {
      const instanceSettings = getMockDSInstanceSettings();
      instanceSettings.database = 'should_not_be_used';
      ds = getMockInfluxDS(instanceSettings);
      expect(ds.database).toBe('site');
    });

    it('should fallback to use use database is dbName is not exist', () => {
      const instanceSettings = getMockDSInstanceSettings();
      instanceSettings.database = 'fallback';
      instanceSettings.jsonData.dbName = undefined;
      ds = getMockInfluxDS(instanceSettings);
      expect(ds.database).toBe('fallback');
    });
  });
});

describe('InfluxDataSource Backend Mode [influxdbBackendMigration=true]', () => {
  beforeEach(() => {
    // we want only backend mode in this suite
    config.featureToggles.influxdbBackendMigration = true;
    jest.clearAllMocks();
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

describe('interpolateQueryExpr', () => {
  const templateSrvStub = {
    replace: jest.fn().mockImplementation((...rest: unknown[]) => 'templateVarReplaced'),
  } as unknown as TemplateSrv;
  let ds = getMockInfluxDS(getMockDSInstanceSettings(), templateSrvStub);
  it('should return the value as it is', () => {
    const value = 'normalValue';
    const variableMock = queryBuilder().withId('tempVar').withName('tempVar').withMulti(false).build();
    const result = ds.interpolateQueryExpr(value, variableMock, 'my query $tempVar');
    const expectation = 'normalValue';
    expect(result).toBe(expectation);
  });

  it('should return the escaped value if the value wrapped in regex', () => {
    const value = '/special/path';
    const variableMock = queryBuilder().withId('tempVar').withName('tempVar').withMulti(false).build();
    const result = ds.interpolateQueryExpr(
      value,
      variableMock,
      'select atan(z/sqrt(3.14)), that where path =~ /$tempVar/'
    );
    const expectation = `\\/special\\/path`;
    expect(result).toBe(expectation);
  });

  it('should return the escaped value if the value wrapped in regex 2', () => {
    const value = '/special/path';
    const variableMock = queryBuilder().withId('tempVar').withName('tempVar').withMulti(false).build();
    const result = ds.interpolateQueryExpr(
      value,
      variableMock,
      'select atan(z/sqrt(3.14)), that where path !~ /^$tempVar$/'
    );
    const expectation = `\\/special\\/path`;
    expect(result).toBe(expectation);
  });

  it('should return the escaped value if the value wrapped in regex 3', () => {
    const value = ['env', 'env2', 'env3'];
    const variableMock = queryBuilder()
      .withId('tempVar')
      .withName('tempVar')
      .withMulti(false)
      .withIncludeAll(true)
      .build();
    const result = ds.interpolateQueryExpr(
      value,
      variableMock,
      'select atan(z/sqrt(3.14)), thing from path =~ /^($tempVar)$/'
    );
    const expectation = `(env|env2|env3)`;
    expect(result).toBe(expectation);
  });

  it('should **not** return the escaped value if the value **is not** wrapped in regex', () => {
    const value = '/special/path';
    const variableMock = queryBuilder().withId('tempVar').withName('tempVar').withMulti(false).build();
    const result = ds.interpolateQueryExpr(value, variableMock, `select that where path = '$tempVar'`);
    const expectation = `/special/path`;
    expect(result).toBe(expectation);
  });

  it('should **not** return the escaped value if the value **is not** wrapped in regex 2', () => {
    const value = '12.2';
    const variableMock = queryBuilder().withId('tempVar').withName('tempVar').withMulti(false).build();
    const result = ds.interpolateQueryExpr(value, variableMock, `select that where path = '$tempVar'`);
    const expectation = `12.2`;
    expect(result).toBe(expectation);
  });

  it('should escape the value **always** if the variable is a multi-value variable', () => {
    const value = [`/special/path`, `/some/other/path`];
    const variableMock = queryBuilder().withId('tempVar').withName('tempVar').withMulti().build();
    const result = ds.interpolateQueryExpr(value, variableMock, `select that where path = '$tempVar'`);
    const expectation = `(\\/special\\/path|\\/some\\/other\\/path)`;
    expect(result).toBe(expectation);
  });

  it('should escape and join with the pipe even the variable is not multi-value', () => {
    const variableMock = queryBuilder()
      .withId('tempVar')
      .withName('tempVar')
      .withCurrent('All', '$__all')
      .withMulti(false)
      .withAllValue('')
      .withIncludeAll()
      .withOptions(
        {
          text: 'All',
          value: '$__all',
        },
        {
          text: `/special/path`,
          value: `/special/path`,
        },
        {
          text: `/some/other/path`,
          value: `/some/other/path`,
        }
      )
      .build();
    const value = [`/special/path`, `/some/other/path`];
    const result = ds.interpolateQueryExpr(value, variableMock, `select that where path =~ /$tempVar/`);
    const expectation = `(\\/special\\/path|\\/some\\/other\\/path)`;
    expect(result).toBe(expectation);
  });

  it('should **not** return the escaped value if the value **is not** wrapped in regex and the query is more complex (e.g. text is contained between two / but not a regex', () => {
    const value = 'testmatch';
    const variableMock = queryBuilder().withId('tempVar').withName('tempVar').withMulti(false).build();
    const result = ds.interpolateQueryExpr(
      value,
      variableMock,
      `select value where ("tag"::tag =~ /value/) AND where other = $tempVar $timeFilter GROUP BY time($__interval) tz('Europe/London')`
    );
    const expectation = `testmatch`;
    expect(result).toBe(expectation);
  });

  it('should return floating point number as it is', () => {
    const variableMock = queryBuilder()
      .withId('tempVar')
      .withName('tempVar')
      .withMulti(false)
      .withOptions({
        text: `1.0`,
        value: `1.0`,
      })
      .build();
    const value = `1.0`;
    const result = ds.interpolateQueryExpr(value, variableMock, `select value / $tempVar from /^measurement$/`);
    const expectation = `1.0`;
    expect(result).toBe(expectation);
  });

  it('template var in adhoc', () => {
    const templateVarName = '$templateVarName';
    const templateVarValue = 'templateVarValue';
    const templateSrvStub = {
      replace: jest
        .fn()
        .mockImplementation((target?: string) => (target === templateVarName ? templateVarValue : target)),
    } as unknown as TemplateSrv;
    const ds = getMockInfluxDS(getMockDSInstanceSettings(), templateSrvStub);
    ds.version = InfluxVersion.SQL;
    const adhocFilter: AdHocVariableFilter[] = [{ key: 'bar', value: templateVarName, operator: '=' }];
    const result = ds.applyTemplateVariables(mockInfluxQueryRequest() as unknown as InfluxQuery, {}, adhocFilter);
    expect(result.tags![0].value).toBe(templateVarValue);
    expect(result.adhocFilters![0].value).toBe(templateVarValue);
  });
});

describe('interpolateVariablesInQueries', () => {
  const templateSrvStub = {
    replace: jest.fn().mockImplementation((target: string) => {
      if (target === '$database') {
        return 'test_db';
      }
      if (target === '$measurement') {
        return 'cpu_usage';
      }
      if (target === 'SELECT * FROM $measurement WHERE database = "$database"') {
        return 'SELECT * FROM cpu_usage WHERE database = "test_db"';
      }
      if (target === 'SELECT * FROM $measurement') {
        return 'SELECT * FROM cpu_usage';
      }
      if (target === '$server') {
        return 'prod-server';
      }
      return target;
    }),
  } as unknown as TemplateSrv;
  let dsInfluxQL = getMockInfluxDS(getMockDSInstanceSettings(), templateSrvStub);
  let dsFlux = getMockInfluxDS(getMockDSInstanceSettings({ version: InfluxVersion.Flux }), templateSrvStub);
  let dsSQL = getMockInfluxDS(getMockDSInstanceSettings({ version: InfluxVersion.SQL }), templateSrvStub);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return an empty array if there are no queries', () => {
    const result = dsInfluxQL.interpolateVariablesInQueries([], {}, []);
    expect(result).toEqual([]);
  });

  it('should interpolate template variables in query rawQuery (Flux)', () => {
    const queries: InfluxQuery[] = [
      {
        refId: 'A',
        rawQuery: true,
        query: 'SELECT * FROM $measurement WHERE database = "$database"',
      } as InfluxQuery,
    ];

    const result = dsFlux.interpolateVariablesInQueries(queries, {}, []);

    expect(result).toHaveLength(1);
    expect(result[0].query).toBe('SELECT * FROM cpu_usage WHERE database = "test_db"');
  });

  it('should apply adhoc filters to queries (InfluxQL)', () => {
    const queries: InfluxQuery[] = [
      {
        refId: 'A',
        rawQuery: false,
        measurement: 'cpu',
        tags: [],
      } as InfluxQuery,
    ];

    const adhocFilters: AdHocVariableFilter[] = [
      { key: 'host', value: 'server1', operator: '=' },
      { key: 'region', value: 'us-east', operator: '=' },
    ];

    const result = dsInfluxQL.interpolateVariablesInQueries(queries, {}, adhocFilters);

    expect(result).toHaveLength(1);
    expect(result[0].adhocFilters).toEqual(adhocFilters);
  });

  it('should apply adhoc filters to queries (SQL)', () => {
    const queries: InfluxQuery[] = [
      {
        refId: 'A',
        rawQuery: false,
        measurement: 'cpu',
        tags: [],
      } as InfluxQuery,
    ];

    const adhocFilters: AdHocVariableFilter[] = [
      { key: 'host', value: 'server1', operator: '=' },
      { key: 'region', value: 'us-east', operator: '=' },
    ];

    const result = dsSQL.interpolateVariablesInQueries(queries, {}, adhocFilters);

    expect(result).toHaveLength(1);
    expect(result[0].adhocFilters).toEqual(adhocFilters);
  });

  it('should interpolate template variables in adhoc filter values (InfluxQL)', () => {
    const templateSrvWithAdhoc = {
      replace: jest.fn().mockImplementation((target: string) => {
        if (target === '$server') {
          return 'prod-server';
        }
        return target;
      }),
    } as unknown as TemplateSrv;

    const ds = getMockInfluxDS(getMockDSInstanceSettings({ version: InfluxVersion.InfluxQL }), templateSrvWithAdhoc);
    const queries: InfluxQuery[] = [
      {
        refId: 'A',
        rawQuery: false,
        measurement: 'cpu',
        tags: [],
      } as InfluxQuery,
    ];

    const adhocFilters: AdHocVariableFilter[] = [{ key: 'host', value: '$server', operator: '=' }];

    const result = ds.interpolateVariablesInQueries(queries, {}, adhocFilters);

    expect(result[0].adhocFilters![0].value).toBe('prod-server');
  });

  it('should preserve existing tags when applying adhoc filters', () => {
    const queries: InfluxQuery[] = [
      {
        refId: 'A',
        rawQuery: false,
        measurement: 'cpu',
        tags: [{ key: 'datacenter', value: 'dc1', operator: '=' }],
      } as InfluxQuery,
    ];

    const adhocFilters: AdHocVariableFilter[] = [{ key: 'host', value: 'server1', operator: '=' }];

    const result = dsInfluxQL.interpolateVariablesInQueries(queries, {}, adhocFilters);

    expect(result[0].tags?.length).toEqual(2);
    expect(result[0].tags![0]).toEqual({ key: 'datacenter', value: 'dc1', operator: '=' });
    expect(result[0].tags![1]).toEqual({ key: 'host', value: 'server1', operator: '=' });
    expect(result[0].adhocFilters).toEqual(adhocFilters);
  });

  it('should handle empty adhoc filters array', () => {
    const queries: InfluxQuery[] = [
      {
        refId: 'A',
        rawQuery: true,
        query: 'SELECT * FROM cpu',
      } as InfluxQuery,
    ];

    const result = dsInfluxQL.interpolateVariablesInQueries(queries, {}, []);

    expect(result).toHaveLength(1);
    expect(result[0].adhocFilters).toEqual([]);
  });
});
