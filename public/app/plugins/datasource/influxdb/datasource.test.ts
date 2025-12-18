import { of } from 'rxjs';

import { AdHocVariableFilter } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

import { queryBuilder } from '../../../features/variables/shared/testing/builders';

import { getMockDSInstanceSettings, getMockInfluxDS, mockBackendService } from './mocks/datasource';
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

describe('InfluxDataSource Backend Mode', () => {
  beforeEach(() => {
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

  // Mock console.warn as we expect tests to use it
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return the value as it is', () => {
    const value = 'normalValue';
    const variableMock = queryBuilder().withId('tempVar').withName('tempVar').withMulti(false).build();
    const result = ds.interpolateQueryExpr(value, variableMock, 'my query $tempVar');
    const expectation = 'normalValue';
    expect(result).toBe(expectation);
  });

  it('should return the escaped value if the value wrapped in regex without !~ or =~', () => {
    const value = '/special/path';
    const variableMock = queryBuilder().withId('tempVar').withName('tempVar').withMulti(false).build();
    const result = ds.interpolateQueryExpr(
      value,
      variableMock,
      'select atan(z/sqrt(3.14)), that where path /$tempVar/'
    );
    const expectation = `\\/special\\/path`;
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
