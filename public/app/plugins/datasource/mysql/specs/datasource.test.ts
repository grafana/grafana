import { of } from 'rxjs';

import {
  dataFrameToJSON,
  getDefaultTimeRange,
  DataSourceInstanceSettings,
  FieldType,
  createDataFrame,
} from '@grafana/data';
import { FetchResponse } from '@grafana/runtime';
import { SQLQuery, makeVariable } from '@grafana/sql';

import { MySqlDatasource } from '../MySqlDatasource';
import { MySQLOptions } from '../types';

const fetchMock = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    fetch: fetchMock,
  }),
}));

const uid = '0000';
// mock uuidv4 to give back the same value every time
jest.mock('uuid', () => ({
  v4: () => uid,
}));

describe('MySQLDatasource', () => {
  const defaultRange = getDefaultTimeRange(); // it does not matter what value this has
  const setupTestContext = (response: unknown, templateSrv?: unknown) => {
    jest.clearAllMocks();
    const instanceSettings = {
      jsonData: {
        defaultProject: 'testproject',
      },
    } as unknown as DataSourceInstanceSettings<MySQLOptions>;
    const variable = makeVariable('id1', 'name1');
    fetchMock.mockImplementation((options) => of(createFetchResponse(response)));

    const ds = new MySqlDatasource(instanceSettings);
    if (templateSrv !== undefined) {
      Reflect.set(ds, 'templateSrv', templateSrv);
    }

    return { ds, variable, fetchMock };
  };

  const simpleTemplateSrv = {
    replace: (text: string) => text,
  };

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
      const ds = setupTestContext(response, simpleTemplateSrv).ds;
      const query = 'select * from atable';
      const results = await ds.metricFindQuery(query, { range: defaultRange });
      expect(results.length).toBe(0);
    });

    it('should return an empty array when fetchDatasets is called', async () => {
      const ds = setupTestContext(response).ds;
      const results = await ds.fetchDatasets();
      expect(results.length).toBe(0);
    });

    it('should return an empty array when fetchTables is called', async () => {
      const ds = setupTestContext(response).ds;
      const results = await ds.fetchTables();
      expect(results.length).toBe(0);
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
    it('should return a list of datasets when fetchDatasets is called', async () => {
      const fetchDatasetsResponse = {
        results: {
          datasets: {
            refId: 'datasets',
            frames: [
              dataFrameToJSON(
                createDataFrame({
                  fields: [{ name: 'name', type: FieldType.string, values: ['test1', 'test2', 'test3'] }],
                })
              ),
            ],
          },
        },
      };
      const { ds } = setupTestContext(fetchDatasetsResponse);

      const results = await ds.fetchDatasets();
      expect(results.length).toBe(3);
      expect(results).toEqual(['test1', 'test2', 'test3']);
    });

    it('should return a list of tables when fetchTables is called', async () => {
      const fetchTableResponse = {
        results: {
          tables: {
            refId: 'tables',
            frames: [
              dataFrameToJSON(
                createDataFrame({
                  fields: [{ name: 'table_name', type: FieldType.string, values: ['test1', 'test2', 'test3'] }],
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

    it('should return a list of fields when fetchFields is called', async () => {
      const fetchFieldsResponse = {
        results: {
          [`fields-${uid}`]: {
            refId: 'fields',
            frames: [
              dataFrameToJSON(
                createDataFrame({
                  fields: [
                    { name: 'column_name', type: FieldType.string, values: ['test1', 'test2', 'test3'] },
                    { name: 'data_type', type: FieldType.string, values: ['int', 'char', 'bool'] },
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

    it('should return list of all string field values', async () => {
      const { ds } = setupTestContext(response, simpleTemplateSrv);
      const results = await ds.metricFindQuery(query, { range: defaultRange });

      expect(results.length).toBe(6);
      expect(results[0].text).toBe('aTitle');
      expect(results[5].text).toBe('some text3');
    });
  });

  describe('When performing metricFindQuery with $__searchFilter and a searchFilter is given', () => {
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

    it('should return list of all column values', async () => {
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
      const { ds, fetchMock } = setupTestContext(response, templateSrv);
      const results = await ds.metricFindQuery(query, { range: defaultRange, searchFilter: 'aTit' });

      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock.mock.calls[0][0].data.queries[0].rawSql).toBe(
        "select title from atable where title LIKE 'aTit%'"
      );
      expect(results.length).toBe(6);
    });
  });

  describe('When performing metricFindQuery with $__searchFilter but no searchFilter is given', () => {
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

    it('should return list of all column values', async () => {
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
      const { ds, fetchMock } = setupTestContext(response, templateSrv);
      const results = await ds.metricFindQuery(query, { range: defaultRange });

      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock.mock.calls[0][0].data.queries[0].rawSql).toBe("select title from atable where title LIKE '%'");
      expect(results.length).toBe(6);
    });
  });

  describe('When performing metricFindQuery with key, value columns', () => {
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

    it('should return list of as text, value', async () => {
      const { ds } = setupTestContext(response, simpleTemplateSrv);
      const results = await ds.metricFindQuery(query, { range: defaultRange });

      expect(results.length).toBe(3);
      expect(results[0].text).toBe('aTitle');
      expect(results[0].value).toBe('value1');
      expect(results[2].text).toBe('aTitle3');
      expect(results[2].value).toBe('value3');
    });
  });

  describe('When performing metricFindQuery without key, value columns', () => {
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

    it('should return list of all field values as text', async () => {
      const { ds } = setupTestContext(response, simpleTemplateSrv);
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

    it('should return list of unique keys', async () => {
      const { ds } = setupTestContext(response, simpleTemplateSrv);
      const results = await ds.metricFindQuery(query, { range: defaultRange });

      expect(results.length).toBe(1);
      expect(results[0].text).toBe('aTitle');
      expect(results[0].value).toBe('same');
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
        expect(ds.interpolateVariable(1000, variable)).toEqual(1000);
      });
    });

    describe('and value is an array of strings', () => {
      it('should return comma separated quoted values', () => {
        const { ds, variable } = setupTestContext({});
        expect(ds.interpolateVariable(['a', 'b', 'c'], variable)).toEqual("'a','b','c'");
      });
    });

    describe('and variable allows multi-value and value is a string', () => {
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
      });
    });

    describe('and variable allows all and value is a string', () => {
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
      $__timeGroup(createdAt,'$summarize') as time_sec,
      avg(value) as value,
      hostname as metric
    FROM
      grafana_metric
    WHERE
      $__timeFilter(createdAt) AND
      foo = 'bar' AND
      measurement = 'logins.count' AND
      hostname IN($host)
    GROUP BY 1, 3
    ORDER BY 1`;
      const query = {
        rawSql,
        rawQuery: true,
        refId: '',
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
      const { ds } = setupTestContext({}, templateSrv);
      expect(ds.targetContainsTemplate(query)).toBeTruthy();
    });

    it('given query that only contains global template variable it should return false', () => {
      const rawSql = `SELECT
      $__timeGroup(createdAt,'$__interval') as time_sec,
      avg(value) as value,
      hostname as metric
    FROM
      grafana_metric
    WHERE
      $__timeFilter(createdAt) AND
      measurement = 'logins.count'
    GROUP BY 1, 3
    ORDER BY 1`;
      const query = {
        rawSql,
        rawQuery: true,
        refId: '',
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
          return false;
        },
      };
      const { ds } = setupTestContext({}, templateSrv);
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
