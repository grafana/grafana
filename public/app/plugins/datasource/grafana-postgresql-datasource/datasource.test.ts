import { Observable, of } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';

import {
  getDefaultTimeRange,
  dataFrameToJSON,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  dateTime,
  FieldType,
  LoadingState,
  createDataFrame,
} from '@grafana/data';
import {
  BackendSrv,
  DataSourceSrv,
  FetchResponse,
  getBackendSrv,
  setBackendSrv,
  getDataSourceSrv,
  setDataSourceSrv,
} from '@grafana/runtime';
import { QueryFormat, SQLQuery, makeVariable } from '@grafana/sql';

import { PostgresDatasource } from './datasource';
import { PostgresOptions } from './types';

const backendSrv: BackendSrv = {
  // this will get mocked below, it only needs to exist
  fetch: () => undefined,
} as unknown as BackendSrv; // we cast it so that we do not have to implement all the methods

// we type this as `any` to not have to define the whole type
const fakeDataSourceSrv: DataSourceSrv = {
  getInstanceSettings: () => ({ id: 8674 }),
} as unknown as DataSourceSrv;

const uid = '0000';
// mock uuidv4 to give back the same value every time
jest.mock('uuid', () => ({
  v4: () => uid,
}));

let origBackendSrv: BackendSrv;
let origDataSourceSrv: DataSourceSrv;
beforeAll(() => {
  origBackendSrv = getBackendSrv();
  origDataSourceSrv = getDataSourceSrv();
  setBackendSrv(backendSrv);
  setDataSourceSrv(fakeDataSourceSrv);
});

afterAll(() => {
  setBackendSrv(origBackendSrv);
  setDataSourceSrv(origDataSourceSrv);
});

describe('PostgreSQLDatasource', () => {
  const defaultRange = getDefaultTimeRange(); // it does not matter what value this has
  const fetchMock = jest.spyOn(backendSrv, 'fetch');
  const setupTestContext = (data: unknown, mock?: Observable<FetchResponse<unknown>>, templateSrv?: unknown) => {
    jest.clearAllMocks();
    const defaultMock = () => mock ?? of(createFetchResponse(data));
    fetchMock.mockImplementation(defaultMock);
    const instanceSettings = {
      jsonData: {
        defaultProject: 'testproject',
      },
    } as unknown as DataSourceInstanceSettings<PostgresOptions>;
    const variable = makeVariable('id1', 'name1');
    const ds = new PostgresDatasource(instanceSettings);
    if (templateSrv !== undefined) {
      Reflect.set(ds, 'templateSrv', templateSrv);
    }
    return { ds, variable };
  };

  // https://rxjs-dev.firebaseapp.com/guide/testing/marble-testing
  const runMarbleTest = (args: {
    options: DataQueryRequest<SQLQuery>;
    values: { [marble: string]: FetchResponse };
    marble: string;
    expectedValues: { [marble: string]: DataQueryResponse };
    expectedMarble: string;
  }) => {
    const { expectedValues, expectedMarble, options, values, marble } = args;
    const scheduler: TestScheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);
    });

    const { ds } = setupTestContext({});

    scheduler.run(({ cold, expectObservable }) => {
      const source = cold(marble, values);
      jest.clearAllMocks();
      fetchMock.mockImplementation(() => source);

      const result = ds.query(options);
      expectObservable(result).toBe(expectedMarble, expectedValues);
    });
  };

  const simpleTemplateSrv = {
    replace: (text: string) => text,
  };

  describe('When performing a time series query', () => {
    it('should transform response correctly', () => {
      const options: DataQueryRequest<SQLQuery> = {
        range: {
          from: dateTime(1432288354),
          to: dateTime(1432288401),
          raw: {
            from: 'now-24h',
            to: 'now',
          },
        },
        targets: [
          {
            format: QueryFormat.Timeseries,
            rawQuery: true,
            rawSql: 'select time, metric from grafana_metric',
            refId: 'A',
            datasource: { type: 'gdev-ds', uid: 'gdev-ds' },
          },
        ],
        requestId: 'test',
        interval: '1m',
        intervalMs: 60000,
        scopedVars: {},
        timezone: 'Etc/UTC',
        app: 'Grafana',
        startTime: 1432288354,
      };
      const response = {
        results: {
          A: {
            refId: 'A',
            frames: [
              dataFrameToJSON(
                createDataFrame({
                  fields: [
                    { name: 'time', values: [1599643351085] },
                    { name: 'metric', values: [30.226249741223704], labels: { metric: 'America' } },
                  ],
                  meta: {
                    executedQueryString: 'select time, metric from grafana_metric',
                  },
                })
              ),
            ],
          },
        },
      };

      const values = { a: createFetchResponse(response) };
      const marble = '-a|';
      const expectedMarble = '-a|';
      const expectedValues: { a: DataQueryResponse } = {
        a: {
          data: [
            {
              fields: [
                {
                  config: {},
                  entities: {},
                  name: 'time',
                  type: 'time',
                  values: [1599643351085],
                },
                {
                  config: {},
                  entities: {},
                  labels: {
                    metric: 'America',
                  },
                  name: 'metric',
                  type: 'number',
                  values: [30.226249741223704],
                },
              ],
              length: 1,
              meta: {
                executedQueryString: 'select time, metric from grafana_metric',
              },
              name: undefined,
              refId: 'A',
            },
          ],
          state: LoadingState.Done,
        },
      };

      runMarbleTest({ options, marble, values, expectedMarble, expectedValues });
    });
  });

  describe('When performing a table query', () => {
    it('should transform response correctly', () => {
      const options: DataQueryRequest<SQLQuery> = {
        range: {
          from: dateTime(1432288354),
          to: dateTime(1432288401),
          raw: {
            from: 'now-24h',
            to: 'now',
          },
        },
        targets: [
          {
            format: QueryFormat.Table,
            rawQuery: true,
            rawSql: 'select time, metric, value from grafana_metric',
            refId: 'A',
            datasource: { type: 'gdev-ds', uid: 'gdev-ds' },
          },
        ],
        requestId: 'test',
        interval: '1m',
        intervalMs: 60000,
        scopedVars: {},
        timezone: 'Etc/UTC',
        app: 'Grafana',
        startTime: 1432288354,
      };
      const response = {
        results: {
          A: {
            refId: 'A',
            frames: [
              dataFrameToJSON(
                createDataFrame({
                  fields: [
                    { name: 'time', values: [1599643351085] },
                    { name: 'metric', values: ['America'] },
                    { name: 'value', values: [30.226249741223704] },
                  ],
                  meta: {
                    executedQueryString: 'select time, metric, value from grafana_metric',
                  },
                })
              ),
            ],
          },
        },
      };

      const values = { a: createFetchResponse(response) };
      const marble = '-a|';
      const expectedMarble = '-a|';
      const expectedValues: { a: DataQueryResponse } = {
        a: {
          data: [
            {
              fields: [
                {
                  config: {},
                  entities: {},
                  name: 'time',
                  type: 'time',
                  values: [1599643351085],
                },
                {
                  config: {},
                  entities: {},
                  name: 'metric',
                  type: 'string',
                  values: ['America'],
                },
                {
                  config: {},
                  entities: {},
                  name: 'value',
                  type: 'number',
                  values: [30.226249741223704],
                },
              ],
              length: 1,
              meta: {
                executedQueryString: 'select time, metric, value from grafana_metric',
              },
              name: undefined,
              refId: 'A',
            },
          ],
          state: LoadingState.Done,
        },
      };

      runMarbleTest({ options, marble, values, expectedMarble, expectedValues });
    });
  });

  describe('When runSql returns an empty dataframe', () => {
    const response = {
      results: {
        tempvar: {
          refId: 'tempvar',
          frames: [],
        },
      },
    };

    it('should return an empty array when metricFindQuery is called', async () => {
      const ds = setupTestContext(response, undefined, simpleTemplateSrv).ds;
      const query = 'select * from atable';
      const results = await ds.metricFindQuery(query, { range: defaultRange });
      expect(results.length).toBe(0);
    });

    it('should return an empty array when fetchTables is called', async () => {
      const ds = setupTestContext(response).ds;
      const results = await ds.fetchTables();
      expect(results.length).toBe(0);
    });

    it('should return empty string when getVersion is called', async () => {
      const ds = setupTestContext(response).ds;
      const results = await ds.getVersion();
      expect(results).toBe('');
    });

    it('should return undefined when getTimescaleDBVersion is called', async () => {
      const ds = setupTestContext(response).ds;
      const results = await ds.getTimescaleDBVersion();
      expect(results).toBe(undefined);
    });

    it('should return an empty array when fetchFields is called', async () => {
      const ds = setupTestContext(response).ds;
      const query: SQLQuery = {
        refId: 'refId',
        table: 'schema.table',
        dataset: 'dataset',
      };
      const results = await ds.fetchFields(query);
      expect(results.length).toBe(0);
    });
  });

  describe('When runSql returns a populated dataframe', () => {
    it('should return a list of tables when fetchTables is called', async () => {
      const fetchTableResponse = {
        results: {
          tables: {
            refId: 'tables',
            frames: [
              dataFrameToJSON(
                createDataFrame({
                  fields: [{ name: 'table', type: FieldType.string, values: ['test1', 'test2', 'test3'] }],
                })
              ),
            ],
          },
        },
      };

      const { ds } = setupTestContext(fetchTableResponse);

      const results = await ds.fetchTables();
      expect(results.length).toBe(3);
      expect(results).toEqual(['test1', 'test2', 'test3']);
    });

    it('should return a version string when getVersion is called', async () => {
      const fetchVersionResponse = {
        results: {
          meta: {
            refId: 'meta',
            frames: [
              dataFrameToJSON(
                createDataFrame({
                  fields: [{ name: 'version', type: FieldType.string, values: ['test1'] }],
                })
              ),
            ],
          },
        },
      };

      const { ds } = setupTestContext(fetchVersionResponse);

      const version = await ds.getVersion();
      expect(version).toBe('test1');
    });

    it('should return a version string when getTimescaleDBVersion is called', async () => {
      const fetchVersionResponse = {
        results: {
          meta: {
            refId: 'meta',
            frames: [
              dataFrameToJSON(
                createDataFrame({
                  fields: [{ name: 'extversion', type: FieldType.string, values: ['test1'] }],
                })
              ),
            ],
          },
        },
      };

      const { ds } = setupTestContext(fetchVersionResponse);

      const version = await ds.getTimescaleDBVersion();
      expect(version).toBe('test1');
    });

    it('should return a list of fields when fetchFields is called', async () => {
      const fetchFieldsResponse = {
        results: {
          [`columns-${uid}`]: {
            frames: [
              dataFrameToJSON(
                createDataFrame({
                  fields: [
                    { name: 'column', type: FieldType.string, values: ['test1', 'test2', 'test3'] },
                    { name: 'type', type: FieldType.string, values: ['int', 'char', 'bool'] },
                  ],
                })
              ),
            ],
          },
        },
      };

      const { ds } = setupTestContext(fetchFieldsResponse);

      const sqlQuery: SQLQuery = {
        refId: 'fields',
        table: 'table',
        dataset: 'dataset',
      };
      const results = await ds.fetchFields(sqlQuery);
      expect(results.length).toBe(3);
      expect(results[0].label).toBe('test1');
      expect(results[0].value).toBe('test1');
      expect(results[0].type).toBe('int');
      expect(results[1].label).toBe('test2');
      expect(results[1].value).toBe('test2');
      expect(results[1].type).toBe('char');
      expect(results[2].label).toBe('test3');
      expect(results[2].value).toBe('test3');
      expect(results[2].type).toBe('bool');
    });
  });

  describe('When performing metricFindQuery that returns multiple string fields', () => {
    it('should return list of all string field values', async () => {
      const query = 'select * from atable';
      const response = {
        results: {
          tempvar: {
            refId: 'tempvar',
            frames: [
              dataFrameToJSON(
                createDataFrame({
                  fields: [
                    { name: 'title', values: ['aTitle', 'aTitle2', 'aTitle3'] },
                    { name: 'text', values: ['some text', 'some text2', 'some text3'] },
                  ],
                  meta: {
                    executedQueryString: 'select * from atable',
                  },
                })
              ),
            ],
          },
        },
      };

      const { ds } = setupTestContext(response, undefined, simpleTemplateSrv);
      const results = await ds.metricFindQuery(query, { range: defaultRange });

      expect(results.length).toBe(6);
      expect(results[0].text).toBe('aTitle');
      expect(results[5].text).toBe('some text3');
    });
  });

  describe('When performing metricFindQuery with $__searchFilter and a searchFilter is given', () => {
    it('should return list of all column values', async () => {
      const query = "select title from atable where title LIKE '$__searchFilter'";
      const response = {
        results: {
          tempvar: {
            refId: 'tempvar',
            frames: [
              dataFrameToJSON(
                createDataFrame({
                  fields: [
                    { name: 'title', values: ['aTitle', 'aTitle2', 'aTitle3'] },
                    { name: 'text', values: ['some text', 'some text2', 'some text3'] },
                  ],
                  meta: {
                    executedQueryString: 'select * from atable',
                  },
                })
              ),
            ],
          },
        },
      };

      const templateSrv = {
        replace: (text: string, scopedVars: unknown) => {
          expect(text).toBe("select title from atable where title LIKE '$__searchFilter'");
          expect(scopedVars).toStrictEqual({
            __searchFilter: {
              value: 'aTit%',
              text: '',
            },
          });
          return "select title from atable where title LIKE 'aTit%'";
        },
      };

      const { ds } = setupTestContext(response, undefined, templateSrv);
      const results = await ds.metricFindQuery(query, { range: defaultRange, searchFilter: 'aTit' });

      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock.mock.calls[0][0].data.queries[0].rawSql).toBe(
        "select title from atable where title LIKE 'aTit%'"
      );
      expect(results).toEqual([
        { text: 'aTitle' },
        { text: 'aTitle2' },
        { text: 'aTitle3' },
        { text: 'some text' },
        { text: 'some text2' },
        { text: 'some text3' },
      ]);
    });
  });

  describe('When performing metricFindQuery with $__searchFilter but no searchFilter is given', () => {
    it('should return list of all column values', async () => {
      const query = "select title from atable where title LIKE '$__searchFilter'";
      const response = {
        results: {
          tempvar: {
            refId: 'tempvar',
            frames: [
              dataFrameToJSON(
                createDataFrame({
                  fields: [
                    { name: 'title', values: ['aTitle', 'aTitle2', 'aTitle3'] },
                    { name: 'text', values: ['some text', 'some text2', 'some text3'] },
                  ],
                  meta: {
                    executedQueryString: 'select * from atable',
                  },
                })
              ),
            ],
          },
        },
      };

      const templateSrv = {
        replace: (text: string, scopedVars: unknown) => {
          expect(text).toBe("select title from atable where title LIKE '$__searchFilter'");
          expect(scopedVars).toStrictEqual({
            __searchFilter: {
              value: '%',
              text: '',
            },
          });
          return "select title from atable where title LIKE '%'";
        },
      };

      const { ds } = setupTestContext(response, undefined, templateSrv);
      const results = await ds.metricFindQuery(query, { range: defaultRange });

      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock.mock.calls[0][0].data.queries[0].rawSql).toBe("select title from atable where title LIKE '%'");
      expect(results).toEqual([
        { text: 'aTitle' },
        { text: 'aTitle2' },
        { text: 'aTitle3' },
        { text: 'some text' },
        { text: 'some text2' },
        { text: 'some text3' },
      ]);
    });
  });

  describe('When performing metricFindQuery with key, value columns', () => {
    it('should return list of as text, value', async () => {
      const query = 'select * from atable';
      const response = {
        results: {
          tempvar: {
            refId: 'tempvar',
            frames: [
              dataFrameToJSON(
                createDataFrame({
                  fields: [
                    { name: '__value', values: ['value1', 'value2', 'value3'] },
                    { name: '__text', values: ['aTitle', 'aTitle2', 'aTitle3'] },
                  ],
                  meta: {
                    executedQueryString: 'select * from atable',
                  },
                })
              ),
            ],
          },
        },
      };
      const { ds } = setupTestContext(response, undefined, simpleTemplateSrv);
      const results = await ds.metricFindQuery(query, { range: defaultRange });

      expect(results).toEqual([
        { text: 'aTitle', value: 'value1' },
        { text: 'aTitle2', value: 'value2' },
        { text: 'aTitle3', value: 'value3' },
      ]);
    });
  });

  describe('When performing metricFindQuery without key, value columns', () => {
    it('should return list of all field values as text', async () => {
      const query = 'select id, values from atable';
      const response = {
        results: {
          tempvar: {
            refId: 'tempvar',
            frames: [
              dataFrameToJSON(
                createDataFrame({
                  fields: [
                    { name: 'id', values: [1, 2, 3] },
                    { name: 'values', values: ['test1', 'test2', 'test3'] },
                  ],
                  meta: {
                    executedQueryString: 'select id, values from atable',
                  },
                })
              ),
            ],
          },
        },
      };
      const { ds } = setupTestContext(response, undefined, simpleTemplateSrv);
      const results = await ds.metricFindQuery(query, { range: defaultRange });

      expect(results).toEqual([
        { text: 1 },
        { text: 2 },
        { text: 3 },
        { text: 'test1' },
        { text: 'test2' },
        { text: 'test3' },
      ]);
    });
  });

  describe('When performing metricFindQuery with key, value columns and with duplicate keys', () => {
    it('should return list of unique keys', async () => {
      const query = 'select * from atable';
      const response = {
        results: {
          tempvar: {
            refId: 'tempvar',
            frames: [
              dataFrameToJSON(
                createDataFrame({
                  fields: [
                    { name: '__text', values: ['aTitle', 'aTitle', 'aTitle'] },
                    { name: '__value', values: ['same', 'same', 'diff'] },
                  ],
                  meta: {
                    executedQueryString: 'select * from atable',
                  },
                })
              ),
            ],
          },
        },
      };
      const { ds } = setupTestContext(response, undefined, simpleTemplateSrv);
      const results = await ds.metricFindQuery(query, { range: defaultRange });

      expect(results).toEqual([{ text: 'aTitle', value: 'same' }]);
    });
  });

  describe('When interpolating variables', () => {
    describe('and value is a string', () => {
      it('should return an unquoted value', () => {
        const { ds, variable } = setupTestContext({});
        expect(ds.interpolateVariable('abc', variable)).toEqual('abc');
      });
    });

    describe('and value is a number', () => {
      it('should return an unquoted value', () => {
        const { ds, variable } = setupTestContext({});
        expect(ds.interpolateVariable(1000 as unknown as string, variable)).toEqual(1000);
      });
    });

    describe('and value is an array of strings', () => {
      it('should return comma separated quoted values', () => {
        const { ds, variable } = setupTestContext({});
        expect(ds.interpolateVariable(['a', 'b', 'c'], variable)).toEqual("'a','b','c'");
      });
    });

    describe('and variable allows multi-value and is a string', () => {
      it('should return a quoted value', () => {
        const { ds, variable } = setupTestContext({});
        variable.multi = true;
        expect(ds.interpolateVariable('abc', variable)).toEqual("'abc'");
      });
    });

    describe('and variable contains single quote', () => {
      it('should return a quoted value', () => {
        const { ds, variable } = setupTestContext({});
        variable.multi = true;
        expect(ds.interpolateVariable("a'bc", variable)).toEqual("'a''bc'");
        expect(ds.interpolateVariable("a'b'c", variable)).toEqual("'a''b''c'");
      });
    });

    describe('and variable allows all and is a string', () => {
      it('should return a quoted value', () => {
        const { ds, variable } = setupTestContext({});
        variable.includeAll = true;
        expect(ds.interpolateVariable('abc', variable)).toEqual("'abc'");
      });
    });
  });

  describe('targetContainsTemplate', () => {
    it('given query that contains template variable it should return true', () => {
      const rawSql = `SELECT
      $__timeGroup("createdAt",'$summarize'),
      avg(value) as "value",
      hostname as "metric"
    FROM
      grafana_metric
    WHERE
      $__timeFilter("createdAt") AND
      measurement = 'logins.count' AND
      hostname IN($host)
    GROUP BY time, metric
    ORDER BY time`;
      const query: SQLQuery = {
        rawSql,
        refId: 'A',
        rawQuery: true,
      };

      // a fake template server:
      // it assumes there are two template variables defined:
      // - summarize
      // - host
      const templateSrv = {
        containsTemplate: (text: string) => {
          // when the text arrives here, it has been already pre-processed
          // by the sql datasource, sql-specific variables have been removed
          expect(text).toBe(rawSql.replace(/\$__time(Filter)?/g, ''));
          return true;
        },
      };
      const { ds } = setupTestContext({}, undefined, templateSrv);

      expect(ds.targetContainsTemplate(query)).toBeTruthy();
    });

    it('given query that only contains global template variable it should return false', () => {
      const rawSql = `SELECT
      $__timeGroup("createdAt",'$__interval'),
      avg(value) as "value",
      hostname as "metric"
    FROM
      grafana_metric
    WHERE
      $__timeFilter("createdAt") AND
      measurement = 'logins.count'
    GROUP BY time, metric
    ORDER BY time`;
      const query: SQLQuery = {
        rawSql,
        refId: 'A',
        rawQuery: true,
      };
      // a fake template server:
      // it assumes there are two template variables defined:
      // - summarize
      // - host
      const templateSrv = {
        containsTemplate: (text: string) => {
          // when the text arrives here, it has been already pre-processed
          // by the sql datasource, sql-specific variables has been removed
          expect(text).toBe(rawSql.replace(/\$__time(Filter)?/g, ''));
          return false;
        },
      };
      const { ds } = setupTestContext({}, undefined, templateSrv);

      expect(ds.targetContainsTemplate(query)).toBeFalsy();
    });
  });
});

const createFetchResponse = <T>(data: T): FetchResponse<T> => ({
  data,
  status: 200,
  url: 'http://localhost:3000/api/query',
  config: { url: 'http://localhost:3000/api/query' },
  type: 'basic',
  statusText: 'Ok',
  redirected: false,
  headers: new Headers(),
  ok: true,
});
