import { of } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';

import {
  dataFrameToJSON,
  getDefaultTimeRange,
  DataSourceInstanceSettings,
  dateTime,
  FieldType,
  MetricFindValue,
  createDataFrame,
  TimeRange,
} from '@grafana/data';
import { SQLQuery } from '@grafana/sql';
import { backendSrv } from 'app/core/services/backend_srv';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { initialCustomVariableModelState } from '../../../features/variables/custom/reducer';

import { MssqlDatasource } from './datasource';
import { MssqlOptions } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

// mock uuidv4 to give back the same value every time
jest.mock('uuid', () => ({
  v4: () => '0000',
}));

const instanceSettings = {
  id: 1,
  uid: 'mssql-datasource',
  type: 'mssql',
  name: 'MSSQL',
  access: 'direct',
} as DataSourceInstanceSettings<MssqlOptions>;

describe('MSSQLDatasource', () => {
  const defaultRange = getDefaultTimeRange(); // it does not matter what value this has
  const fetchMock = jest.spyOn(backendSrv, 'fetch');

  const ctx = {
    ds: new MssqlDatasource(instanceSettings),
    variable: { ...initialCustomVariableModelState },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    ctx.ds = new MssqlDatasource(instanceSettings);
  });

  describe('When performing metricFindQuery that returns multiple string fields', () => {
    let results: MetricFindValue[];
    const query = 'select * from atable';
    const response = {
      results: {
        tempvar: {
          frames: [
            dataFrameToJSON(
              createDataFrame({
                fields: [
                  { name: 'title', values: ['aTitle', 'aTitle2', 'aTitle3'] },
                  { name: 'text', values: ['some text', 'some text2', 'some text3'] },
                ],
              })
            ),
          ],
        },
      },
    };

    beforeEach(() => {
      fetchMock.mockImplementation(() => of(createFetchResponse(response)));

      return ctx.ds.metricFindQuery(query, { range: defaultRange }).then((data: MetricFindValue[]) => {
        results = data;
      });
    });

    it('should return list of all column values', () => {
      expect(results.length).toBe(6);
      expect(results[0].text).toBe('aTitle');
      expect(results[5].text).toBe('some text3');
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

    beforeEach(async () => {
      fetchMock.mockImplementation(() => of(createFetchResponse(response)));
    });

    it('should return an empty array when metricFindQuery is called', async () => {
      const query = 'select * from atable';
      const results = await ctx.ds.metricFindQuery(query, { range: defaultRange });
      expect(results.length).toBe(0);
    });

    it('should return an empty array when fetchDatasets is called', async () => {
      const results = await ctx.ds.fetchDatasets();
      expect(results.length).toBe(0);
    });

    it('should return an empty array when fetchTables is called', async () => {
      const results = await ctx.ds.fetchTables();
      expect(results.length).toBe(0);
    });

    it('should return an empty array when fetchFields is called', async () => {
      const query: SQLQuery = {
        refId: 'refId',
        table: 'schema.table',
        dataset: 'dataset',
      };
      const results = await ctx.ds.fetchFields(query);
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
      fetchMock.mockImplementation(() => of(createFetchResponse(fetchDatasetsResponse)));

      const results = await ctx.ds.fetchDatasets();
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
                  fields: [{ name: 'schemaAndName', type: FieldType.string, values: ['test1', 'test2', 'test3'] }],
                })
              ),
            ],
          },
        },
      };

      fetchMock.mockImplementation(() => of(createFetchResponse(fetchTableResponse)));

      const results = await ctx.ds.fetchTables();
      expect(results.length).toBe(3);
      expect(results).toEqual(['test1', 'test2', 'test3']);
    });

    it('should return a list of fields when fetchFields is called', async () => {
      const fetchFieldsResponse = {
        results: {
          [`columns-0000`]: {
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

      fetchMock.mockImplementation(() => of(createFetchResponse(fetchFieldsResponse)));

      const sqlQuery: SQLQuery = {
        refId: 'fields',
        table: 'table',
        dataset: 'dataset',
      };
      const results = await ctx.ds.fetchFields(sqlQuery);
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

  describe('When performing metricFindQuery with key, value columns', () => {
    let results: MetricFindValue[];
    const query = 'select * from atable';
    const response = {
      results: {
        tempvar: {
          frames: [
            dataFrameToJSON(
              createDataFrame({
                fields: [
                  { name: '__value', values: ['value1', 'value2', 'value3'] },
                  { name: '__text', values: ['aTitle', 'aTitle2', 'aTitle3'] },
                ],
              })
            ),
          ],
        },
      },
    };

    beforeEach(() => {
      fetchMock.mockImplementation(() => of(createFetchResponse(response)));

      return ctx.ds.metricFindQuery(query, { range: defaultRange }).then((data) => {
        results = data;
      });
    });

    it('should return list of as text, value', () => {
      expect(results.length).toBe(3);
      expect(results[0].text).toBe('aTitle');
      expect(results[0].value).toBe('value1');
      expect(results[2].text).toBe('aTitle3');
      expect(results[2].value).toBe('value3');
    });
  });

  describe('When performing metricFindQuery without key, value columns', () => {
    let results: MetricFindValue[];
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

    beforeEach(() => {
      fetchMock.mockImplementation(() => of(createFetchResponse(response)));

      return ctx.ds.metricFindQuery(query, { range: defaultRange }).then((data) => {
        results = data;
      });
    });

    it('should return list of all field values as text', () => {
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
    let results: MetricFindValue[];
    const query = 'select * from atable';
    const response = {
      results: {
        tempvar: {
          frames: [
            dataFrameToJSON(
              createDataFrame({
                fields: [
                  { name: '__text', values: ['aTitle', 'aTitle', 'aTitle'] },
                  { name: '__value', values: ['same', 'same', 'diff'] },
                ],
              })
            ),
          ],
        },
      },
    };

    beforeEach(() => {
      fetchMock.mockImplementation(() => of(createFetchResponse(response)));
      return ctx.ds.metricFindQuery(query, { range: defaultRange }).then((data) => {
        results = data;
      });
    });

    it('should return list of unique keys', () => {
      expect(results.length).toBe(1);
      expect(results[0].text).toBe('aTitle');
      expect(results[0].value).toBe('same');
    });
  });

  describe('When performing metricFindQuery', () => {
    const query = 'select * from atable';
    const response = {
      results: {
        tempvar: {
          frames: [
            dataFrameToJSON(
              createDataFrame({
                fields: [{ name: 'test', values: ['aTitle'] }],
              })
            ),
          ],
        },
      },
    };
    const time: TimeRange = {
      from: dateTime(1521545610656),
      to: dateTime(1521546251185),
      raw: { from: '1521545610656', to: '1521546251185' },
    };

    beforeEach(() => {
      fetchMock.mockImplementation(() => of(createFetchResponse(response)));

      return ctx.ds.metricFindQuery(query, { range: time });
    });

    it('should pass timerange to datasourceRequest', () => {
      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock.mock.calls[0][0].data.from).toBe(time.from.valueOf().toString());
      expect(fetchMock.mock.calls[0][0].data.to).toBe(time.to.valueOf().toString());
      expect(fetchMock.mock.calls[0][0].data.queries.length).toBe(1);
      expect(fetchMock.mock.calls[0][0].data.queries[0].rawSql).toBe(query);
    });
  });

  describe('When interpolating variables', () => {
    describe('and value is a string', () => {
      it('should return an unquoted value', () => {
        expect(ctx.ds.interpolateVariable('abc', ctx.variable)).toEqual('abc');
      });
    });

    describe('and value is a number', () => {
      it('should return an unquoted value', () => {
        expect(ctx.ds.interpolateVariable(1000, ctx.variable)).toEqual(1000);
      });
    });

    describe('and value is an array of strings', () => {
      it('should return comma separated quoted values', () => {
        expect(ctx.ds.interpolateVariable(['a', 'b', 'c'], ctx.variable)).toEqual("'a','b','c'");
      });
    });

    describe('and variable allows multi-value and value is a string', () => {
      it('should return a quoted value', () => {
        ctx.variable.multi = true;
        expect(ctx.ds.interpolateVariable('abc', ctx.variable)).toEqual("'abc'");
      });
    });

    describe('and variable contains single quote', () => {
      it('should return a quoted value', () => {
        ctx.variable.multi = true;
        expect(ctx.ds.interpolateVariable("a'bc", ctx.variable)).toEqual("'a''bc'");
      });
    });

    describe('and variable allows all and value is a string', () => {
      it('should return a quoted value', () => {
        ctx.variable.includeAll = true;
        expect(ctx.ds.interpolateVariable('abc', ctx.variable)).toEqual("'abc'");
      });
    });
  });

  describe('targetContainsTemplate', () => {
    it('given query that contains template variable it should return true', () => {
      const templateSrv = new TemplateSrv();
      const rawSql = `SELECT
      $__timeGroup(createdAt,'$summarize') as time,
      avg(value) as value,
      hostname as metric
    FROM
      grafana_metric
    WHERE
      $__timeFilter(createdAt) AND
      measurement = 'logins.count' AND
      hostname IN($host)
    GROUP BY $__timeGroup(createdAt,'$summarize'), hostname
    ORDER BY 1`;
      const query: SQLQuery = {
        rawSql,
        refId: 'A',
      };
      templateSrv.init([
        { type: 'query', name: 'summarize', current: { value: '1m' } },
        { type: 'query', name: 'host', current: { value: 'a' } },
      ]);
      const ds = new MssqlDatasource(instanceSettings);

      Reflect.set(ds, 'templateSrv', templateSrv);
      expect(ds.targetContainsTemplate(query)).toBeTruthy();
    });

    it('given query that only contains global template variable it should return false', () => {
      const templateSrv: TemplateSrv = new TemplateSrv();
      const rawSql = `SELECT
      $__timeGroup(createdAt,'$__interval') as time,
      avg(value) as value,
      hostname as metric
    FROM
      grafana_metric
    WHERE
      $__timeFilter(createdAt) AND
      measurement = 'logins.count'
    GROUP BY $__timeGroup(createdAt,'$summarize'), hostname
    ORDER BY 1`;
      const query: SQLQuery = {
        rawSql,
        refId: 'A',
      };
      templateSrv.init([
        { type: 'query', name: 'summarize', current: { value: '1m' } },
        { type: 'query', name: 'host', current: { value: 'a' } },
      ]);
      const ds = new MssqlDatasource(instanceSettings);
      Reflect.set(ds, 'templateSrv', templateSrv);

      expect(ds.targetContainsTemplate(query)).toBeFalsy();
    });
  });
});
