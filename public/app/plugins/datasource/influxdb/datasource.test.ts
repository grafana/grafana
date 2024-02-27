import { lastValueFrom, of } from 'rxjs';

import { ScopedVars } from '@grafana/data';
import { BackendSrvRequest } from '@grafana/runtime/';
import config from 'app/core/config';

import { TemplateSrv } from '../../../features/templating/template_srv';
import { queryBuilder } from '../../../features/variables/shared/testing/builders';

import { BROWSER_MODE_DISABLED_MESSAGE } from './constants';
import InfluxDatasource from './datasource';
import {
  getMockDSInstanceSettings,
  getMockInfluxDS,
  mockBackendService,
  mockInfluxFetchResponse,
  mockInfluxQueryRequest,
  mockInfluxQueryWithTemplateVars,
  mockTemplateSrv,
} from './mocks';
import { InfluxQuery, InfluxVersion } from './types';

// we want only frontend mode in this file
config.featureToggles.influxdbBackendMigration = false;
const fetchMock = mockBackendService(mockInfluxFetchResponse());

describe('InfluxDataSource Frontend Mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  describe('outdated browser mode', () => {
    it('should throw an error when querying data', async () => {
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

  describe('metricFindQuery with HTTP GET', () => {
    let ds: InfluxDatasource;
    const query = 'SELECT max(value) FROM measurement WHERE $timeFilter';
    const queryOptions = {
      range: {
        from: '2018-01-01T00:00:00Z',
        to: '2018-01-02T00:00:00Z',
      },
    };

    let requestQuery: string;
    let requestMethod: string | undefined;
    let requestData: string | null;
    const fetchMockImpl = (req: BackendSrvRequest) => {
      requestMethod = req.method;
      requestQuery = req.params?.q;
      requestData = req.data;
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

    it('should read the http method from jsonData', async () => {
      ds = getMockInfluxDS(getMockDSInstanceSettings({ httpMode: 'GET' }));
      await ds.metricFindQuery(query, queryOptions);
      expect(requestMethod).toBe('GET');
      ds = getMockInfluxDS(getMockDSInstanceSettings({ httpMode: 'POST' }));
      await ds.metricFindQuery(query, queryOptions);
      expect(requestMethod).toBe('POST');
    });

    it('should replace $timefilter', async () => {
      ds = getMockInfluxDS(getMockDSInstanceSettings({ httpMode: 'GET' }));
      await ds.metricFindQuery(query, queryOptions);
      expect(requestQuery).toMatch('time >= 1514764800000ms and time <= 1514851200000ms');
      ds = getMockInfluxDS(getMockDSInstanceSettings({ httpMode: 'POST' }));
      await ds.metricFindQuery(query, queryOptions);
      expect(requestQuery).toBeFalsy();
      expect(requestData).toMatch('time%20%3E%3D%201514764800000ms%20and%20time%20%3C%3D%201514851200000ms');
    });

    it('should not have any data in request body if http mode is GET', async () => {
      ds = getMockInfluxDS(getMockDSInstanceSettings({ httpMode: 'GET' }));
      await ds.metricFindQuery(query, queryOptions);
      expect(requestData).toBeNull();
    });

    it('should have data in request body if http mode is POST', async () => {
      ds = getMockInfluxDS(getMockDSInstanceSettings({ httpMode: 'POST' }));
      await ds.metricFindQuery(query, queryOptions);
      expect(requestData).not.toBeNull();
      expect(requestData).toMatch('q=SELECT');
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

    // const fetchMock = jest.fn().mockReturnValue(fetchResult);

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
  });

  describe('variable interpolation', () => {
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

    describe('when interpolating query variables for dashboard->explore', () => {
      it('should interpolate all variables with Flux mode', () => {
        ds.version = InfluxVersion.Flux;
        const fluxQuery = {
          refId: 'x',
          query: '$interpolationVar,$interpolationVar2',
        };
        const queries = ds.interpolateVariablesInQueries([fluxQuery], {
          interpolationVar: { text: text, value: text },
          interpolationVar2: { text: text2, value: text2 },
        });
        expect(templateSrv.replace).toBeCalledTimes(1);
        expect(queries[0].query).toBe(textWithFormatRegex);
      });

      it('should interpolate all variables with InfluxQL mode', () => {
        ds.version = InfluxVersion.InfluxQL;
        const queries = ds.interpolateVariablesInQueries([mockInfluxQueryWithTemplateVars(adhocFilters)], {
          interpolationVar: { text: text, value: text },
          interpolationVar2: { text: text2, value: text2 },
        });
        influxChecks(queries[0]);
      });
    });

    describe('when interpolating template variables', () => {
      it('should apply all template variables with Flux mode', () => {
        ds.version = InfluxVersion.Flux;
        const fluxQuery = {
          refId: 'x',
          query: '$interpolationVar',
        };
        const query = ds.applyTemplateVariables(fluxQuery, {
          interpolationVar: {
            text: text,
            value: text,
          },
        });
        expect(templateSrv.replace).toBeCalledTimes(1);
        expect(query.query).toBe(text);
      });
    });

    describe('variable interpolation with chained variables with frontend mode', () => {
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
        const expectation = `env|env2|env3`;
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
        const expectation = `\\/special\\/path|\\/some\\/other\\/path`;
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
        const expectation = `\\/special\\/path|\\/some\\/other\\/path`;
        expect(result).toBe(expectation);
      });
    });
  });
});
