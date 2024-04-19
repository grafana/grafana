import { lastValueFrom, of } from 'rxjs';

import { BackendSrvRequest } from '@grafana/runtime';
import config from 'app/core/config';

import { TemplateSrv } from '../../../features/templating/template_srv';
import { queryBuilder } from '../../../features/variables/shared/testing/builders';

import { getMockDSInstanceSettings, getMockInfluxDS, mockBackendService } from './__mocks__/datasource';
import { queryOptions } from './__mocks__/query';
import { mockInfluxQueryRequest, mockInfluxQueryWithTemplateVars } from './__mocks__/request';
import { mockInfluxFetchResponse, mockMetricFindQueryResponse } from './__mocks__/response';
import { BROWSER_MODE_DISABLED_MESSAGE } from './constants';
import InfluxDatasource from './datasource';
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
      await ds.metricFindQuery(query, queryOptions);
      expect(fetchMock.mock.lastCall[0].params?.q).toMatch('time >= 1514764800000ms and time <= 1514851200000ms');
      ds = getMockInfluxDS(getMockDSInstanceSettings({ httpMode: 'POST' }));
      await ds.metricFindQuery(query, queryOptions);
      expect(fetchMock.mock.lastCall[0].params?.q).toBeFalsy();
      expect(fetchMock.mock.lastCall[0].data).toMatch(
        'time%20%3E%3D%201514764800000ms%20and%20time%20%3C%3D%201514851200000ms'
      );
    });

    it('should not have any data in request body if http mode is GET', async () => {
      ds = getMockInfluxDS(getMockDSInstanceSettings({ httpMode: 'GET' }));
      await ds.metricFindQuery(query, queryOptions);
      expect(fetchMock.mock.lastCall[0].data).toBeNull();
    });

    it('should have data in request body if http mode is POST', async () => {
      ds = getMockInfluxDS(getMockDSInstanceSettings({ httpMode: 'POST' }));
      await ds.metricFindQuery(query, queryOptions);
      expect(fetchMock.mock.lastCall[0].data).not.toBeNull();
      expect(fetchMock.mock.lastCall[0].data).toMatch('q=SELECT');
    });

    it('parse response correctly', async () => {
      ds = getMockInfluxDS(getMockDSInstanceSettings({ httpMode: 'GET' }));
      let responseGet = await ds.metricFindQuery(query, queryOptions);
      expect(responseGet).toEqual([{ text: 'cpu' }]);
      ds = getMockInfluxDS(getMockDSInstanceSettings({ httpMode: 'POST' }));
      let responsePost = await ds.metricFindQuery(query, queryOptions);
      expect(responsePost).toEqual([{ text: 'cpu' }]);
    });
  });

  // Update this after starting to use TemplateSrv from @grafana/runtime package
  describe('adhoc variables', () => {
    const adhocFilters = [
      {
        key: 'adhoc_key',
        operator: '=',
        value: 'adhoc_val',
        condition: '',
      },
    ];
    const mockTemplateService = new TemplateSrv();
    mockTemplateService.getAdhocFilters = jest.fn((_: string) => adhocFilters);
    let ds = getMockInfluxDS(getMockDSInstanceSettings(), mockTemplateService);

    it('query should contain the ad-hoc variable', () => {
      ds.query(mockInfluxQueryRequest());
      const expected = encodeURIComponent(
        'SELECT mean("value") FROM "cpu" WHERE time >= 0ms and time <= 10ms AND "adhoc_key" = \'adhoc_val\' GROUP BY time($__interval) fill(null)'
      );
      expect(fetchMock.mock.calls[0][0].data).toBe(`q=${expected}`);
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

  describe('variable interpolation', () => {
    const variablesMock = [
      queryBuilder().withId('var1').withName('var1').withCurrent('var1_value').build(),
      queryBuilder().withId('path').withName('path').withCurrent('/etc/hosts').build(),
    ];
    const mockTemplateService = new TemplateSrv({
      getVariables: () => variablesMock,
      getVariableWithName: (name: string) => variablesMock.filter((v) => v.name === name)[0],
      getFilteredVariables: jest.fn(),
    });
    // Remove this after start using TemplateSrv from @grafana/runtime
    mockTemplateService.getAdhocFilters = jest.fn();

    describe('when interpolating query variables for dashboard->explore', () => {
      it('should interpolate all variables with Flux mode', () => {
        const ds = getMockInfluxDS(getMockDSInstanceSettings({ version: InfluxVersion.Flux }), mockTemplateService);
        const fluxQuery = {
          refId: 'x',
          query: 'some query with $var1 and $path',
        };
        const queries = ds.interpolateVariablesInQueries([fluxQuery], {});
        expect(queries[0].query).toBe('some query with var1_value and /etc/hosts');
      });

      it('should interpolate all variables with InfluxQL mode', () => {
        const ds = getMockInfluxDS(getMockDSInstanceSettings({ version: InfluxVersion.InfluxQL }), mockTemplateService);
        const [query] = ds.interpolateVariablesInQueries([mockInfluxQueryWithTemplateVars([])], {});
        expect(query.alias).toBe('var1_value');
        expect(query.measurement).toBe('var1_value');
        expect(query.policy).toBe('var1_value');
        expect(query.limit).toBe('var1_value');
        expect(query.slimit).toBe('var1_value');
        expect(query.tz).toBe('var1_value');
        expect(query.tags![0].value).toBe(`/^\\/etc\\/hosts$/`);
        expect(query.groupBy![0].params![0]).toBe('var1_value');
        expect(query.select![0][0].params![0]).toBe('var1_value');
      });
    });

    describe('applyTemplateVariables', () => {
      it('should apply all template variables with Flux mode', () => {
        const ds = getMockInfluxDS(getMockDSInstanceSettings({ version: InfluxVersion.Flux }), mockTemplateService);
        const fluxQuery = {
          refId: 'x',
          query: '$var1',
        };
        const query = ds.applyTemplateVariables(fluxQuery, {});
        expect(query.query).toBe('var1_value');
      });
    });

    describe('variable interpolation with chained variables with frontend mode', () => {
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
          scopedVars: { maxSED: { text: '8.1', value: '8.1' } },
        });
        const qe = `SELECT sum("piece_count") FROM "rp"."pdata" WHERE diameter <= 8.1`;
        const qData = decodeURIComponent(fetchMock.mock.calls[0][0].data.substring(2));
        expect(qData).toBe(qe);
      });

      it('should render chained regex variables with URL', () => {
        ds.metricFindQuery('SHOW TAG VALUES WITH KEY = "agent_url" WHERE agent_url =~ /^$var1$/', {
          scopedVars: {
            var1: {
              text: 'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg',
              value: 'https://aaaa-aa-aaa.bbb.ccc.ddd:8443/ggggg',
            },
          },
        });
        const qe = `SHOW TAG VALUES WITH KEY = "agent_url" WHERE agent_url =~ /^https:\\/\\/aaaa-aa-aaa\\.bbb\\.ccc\\.ddd:8443\\/ggggg$/`;
        const qData = decodeURIComponent(fetchMock.mock.calls[0][0].data.substring(2));
        expect(qData).toBe(qe);
      });

      it('should render chained regex variables with floating point number and url', () => {
        ds.metricFindQuery(
          'SELECT sum("piece_count") FROM "rp"."pdata" WHERE diameter <= $maxSED AND agent_url =~ /^$var1$/',
          {
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
        const qData = decodeURIComponent(fetchMock.mock.calls[0][0].data.substring(2));
        expect(qData).toBe(qe);
      });
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

  describe('variable interpolation with chained variables with backend mode', () => {
    const variablesMock = [
      queryBuilder().withId('var1').withName('var1').withCurrent('var1').build(),
      queryBuilder().withId('path').withName('path').withCurrent('/etc/hosts').build(),
      queryBuilder()
        .withId('field_var')
        .withName('field_var')
        .withMulti(true)
        .withOptions(
          {
            text: `field_1`,
            value: `field_1`,
          },
          {
            text: `field_2`,
            value: `field_2`,
          },
          {
            text: `field_3`,
            value: `field_3`,
          }
        )
        .withCurrent(['field_1', 'field_3'])
        .build(),
    ];
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

    it('should remove regex wrappers when operator is not a regex operator', () => {
      const query: InfluxQuery = {
        refId: 'A',
        tags: [
          {
            key: 'key',
            operator: '=',
            value: '/^$path$/',
          },
        ],
      };
      const res = ds.applyVariables(query, {});
      const expected = `/etc/hosts`;
      expect(res.tags?.[0].value).toEqual(expected);
    });

    it('should interpolate field keys with given scopedVars', () => {
      const query: InfluxQuery = {
        refId: 'A',
        tags: [
          {
            key: 'key',
            operator: '=',
            value: 'value',
          },
        ],
        select: [
          [
            {
              type: 'field',
              params: ['$field_var'],
            },
            {
              type: 'mean',
              params: [],
            },
          ],
        ],
      };
      const res = ds.applyVariables(query, { field_var: { text: 'field_3', value: 'field_3' } });
      const expected = `field_3`;
      expect(res.select?.[0][0].params?.[0]).toEqual(expected);
    });
  });
});

describe('interpolateQueryExpr', () => {
  let ds = getMockInfluxDS(getMockDSInstanceSettings(), new TemplateSrv());
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
    const result = ds.interpolateQueryExpr(value, variableMock, 'select that where path = /$tempVar/');
    const expectation = `\\/special\\/path`;
    expect(result).toBe(expectation);
  });

  it('should return the escaped value if the value wrapped in regex 2', () => {
    const value = '/special/path';
    const variableMock = queryBuilder().withId('tempVar').withName('tempVar').withMulti(false).build();
    const result = ds.interpolateQueryExpr(value, variableMock, 'select that where path = /^$tempVar$/');
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
    const result = ds.interpolateQueryExpr(value, variableMock, 'select from /^($tempVar)$/');
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
    const result = ds.interpolateQueryExpr(value, variableMock, `select that where path = /$tempVar/`);
    const expectation = `(\\/special\\/path|\\/some\\/other\\/path)`;
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
});
