import { of } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { FetchResponse } from '@grafana/runtime';
import { dateTime, toUtc } from '@grafana/data';

import { PostgresDatasource } from '../datasource';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { TemplateSrv } from 'app/features/templating/template_srv';
import { initialCustomVariableModelState } from '../../../../features/variables/custom/reducer';
import { TimeSrv } from '../../../../features/dashboard/services/TimeSrv';
import { observableTester } from '../../../../../test/helpers/observableTester';

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => backendSrv,
}));

describe('PostgreSQLDatasource', () => {
  const fetchMock = jest.spyOn(backendSrv, 'fetch');
  const setupTestContext = (data: any) => {
    jest.clearAllMocks();
    fetchMock.mockImplementation(() => of(createFetchResponse(data)));

    const templateSrv: TemplateSrv = new TemplateSrv();
    const raw = {
      from: toUtc('2018-04-25 10:00'),
      to: toUtc('2018-04-25 11:00'),
    };
    const timeSrvMock = ({
      timeRange: () => ({
        from: raw.from,
        to: raw.to,
        raw: raw,
      }),
    } as unknown) as TimeSrv;
    const variable = { ...initialCustomVariableModelState };
    const ds = new PostgresDatasource({ name: 'dsql' }, templateSrv, timeSrvMock);

    return { ds, templateSrv, timeSrvMock, variable };
  };

  // https://rxjs-dev.firebaseapp.com/guide/testing/marble-testing
  const runMarbleTest = (args: {
    options: any;
    values: { [marble: string]: FetchResponse };
    marble: string;
    expectedValues: { [marble: string]: any };
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

  describe('When performing a time series query', () => {
    it('should transform response correctly', () => {
      const options = {
        range: {
          from: dateTime(1432288354),
          to: dateTime(1432288401),
        },
        targets: [
          {
            format: 'time_series',
            rawQuery: true,
            rawSql: 'select time, metric from grafana_metric',
            refId: 'A',
            datasource: 'gdev-ds',
          },
        ],
      };

      const data = {
        results: {
          A: {
            refId: 'A',
            meta: {
              executedQueryString: 'select time, metric from grafana_metric',
              rowCount: 0,
            },
            series: [
              {
                name: 'America',
                points: [[30.226249741223704, 1599643351085]],
              },
            ],
            tables: null,
            dataframes: null,
          },
        },
      };

      const values = { a: createFetchResponse(data) };
      const marble = '-a|';
      const expectedMarble = '-a|';
      const expectedValues = {
        a: {
          data: [
            {
              datapoints: [[30.226249741223704, 1599643351085]],
              meta: {
                executedQueryString: 'select time, metric from grafana_metric',
                rowCount: 0,
              },
              refId: 'A',
              target: 'America',
            },
          ],
        },
      };

      runMarbleTest({ options, marble, values, expectedMarble, expectedValues });
    });
  });

  describe('When performing a table query', () => {
    it('should transform response correctly', () => {
      const options = {
        range: {
          from: dateTime(1432288354),
          to: dateTime(1432288401),
        },
        targets: [
          {
            format: 'table',
            rawQuery: true,
            rawSql: 'select time, metric, value from grafana_metric',
            refId: 'A',
            datasource: 'gdev-ds',
          },
        ],
      };

      const data = {
        results: {
          A: {
            refId: 'A',
            meta: {
              executedQueryString: 'select time, metric, value from grafana_metric',
              rowCount: 1,
            },
            series: null,
            tables: [
              {
                columns: [
                  {
                    text: 'time',
                  },
                  {
                    text: 'metric',
                  },
                  {
                    text: 'value',
                  },
                ],
                rows: [[1599643351085, 'America', 30.226249741223704]],
              },
            ],
            dataframes: null,
          },
        },
      };

      const values = { a: createFetchResponse(data) };
      const marble = '-a|';
      const expectedMarble = '-a|';
      const expectedValues = {
        a: {
          data: [
            {
              columns: [
                {
                  text: 'time',
                },
                {
                  text: 'metric',
                },
                {
                  text: 'value',
                },
              ],
              rows: [[1599643351085, 'America', 30.226249741223704]],
              type: 'table',
              refId: 'A',
              meta: {
                executedQueryString: 'select time, metric, value from grafana_metric',
                rowCount: 1,
              },
            },
          ],
        },
      };

      runMarbleTest({ options, marble, values, expectedMarble, expectedValues });
    });
  });

  describe('When performing a query with hidden target', () => {
    it('should return empty result and backendSrv.fetch should not be called', done => {
      const options = {
        range: {
          from: dateTime(1432288354),
          to: dateTime(1432288401),
        },
        targets: [
          {
            format: 'table',
            rawQuery: true,
            rawSql: 'select time, metric, value from grafana_metric',
            refId: 'A',
            datasource: 'gdev-ds',
            hide: true,
          },
        ],
      };

      const { ds } = setupTestContext({});

      observableTester().subscribeAndExpectOnNextAndComplete({
        observable: ds.query(options),
        expectOnNext: value => {
          expect(value).toEqual({ data: [] });
        },
        expectOnComplete: () => {
          expect(fetchMock).not.toHaveBeenCalled();
        },
        done,
      });
    });
  });

  describe('When performing annotationQuery', () => {
    it('should return annotation list', async () => {
      const annotationName = 'MyAnno';
      const options = {
        annotation: {
          name: annotationName,
          rawQuery: 'select time, title, text, tags from table;',
        },
        range: {
          from: dateTime(1432288354),
          to: dateTime(1432288401),
        },
      };
      const data = {
        results: {
          MyAnno: {
            refId: annotationName,
            tables: [
              {
                columns: [{ text: 'time' }, { text: 'text' }, { text: 'tags' }],
                rows: [
                  [1432288355, 'some text', 'TagA,TagB'],
                  [1432288390, 'some text2', ' TagB , TagC'],
                  [1432288400, 'some text3'],
                ],
              },
            ],
          },
        },
      };

      const { ds } = setupTestContext(data);

      const results = await ds.annotationQuery(options);

      expect(results.length).toBe(3);

      expect(results[0].text).toBe('some text');
      expect(results[0].tags[0]).toBe('TagA');
      expect(results[0].tags[1]).toBe('TagB');

      expect(results[1].tags[0]).toBe('TagB');
      expect(results[1].tags[1]).toBe('TagC');

      expect(results[2].tags.length).toBe(0);
    });
  });

  describe('When performing metricFindQuery', () => {
    it('should return list of all column values', async () => {
      const query = 'select * from atable';
      const data = {
        results: {
          tempvar: {
            meta: {
              rowCount: 3,
            },
            refId: 'tempvar',
            tables: [
              {
                columns: [{ text: 'title' }, { text: 'text' }],
                rows: [
                  ['aTitle', 'some text'],
                  ['aTitle2', 'some text2'],
                  ['aTitle3', 'some text3'],
                ],
              },
            ],
          },
        },
      };

      const { ds } = setupTestContext(data);

      const results = await ds.metricFindQuery(query, {});

      expect(results.length).toBe(6);
      expect(results[0].text).toBe('aTitle');
      expect(results[5].text).toBe('some text3');
    });
  });

  describe('When performing metricFindQuery with $__searchFilter and a searchFilter is given', () => {
    it('should return list of all column values', async () => {
      const query = "select title from atable where title LIKE '$__searchFilter'";
      const data = {
        results: {
          tempvar: {
            meta: {
              rowCount: 3,
            },
            refId: 'tempvar',
            tables: [
              {
                columns: [{ text: 'title' }, { text: 'text' }],
                rows: [
                  ['aTitle', 'some text'],
                  ['aTitle2', 'some text2'],
                  ['aTitle3', 'some text3'],
                ],
              },
            ],
          },
        },
      };

      const { ds } = setupTestContext(data);

      const results = await ds.metricFindQuery(query, { searchFilter: 'aTit' });

      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock.mock.calls[0][0].data.queries[0].rawSql).toBe(
        "select title from atable where title LIKE 'aTit%'"
      );
      expect(results).toEqual([
        { text: 'aTitle' },
        { text: 'some text' },
        { text: 'aTitle2' },
        { text: 'some text2' },
        { text: 'aTitle3' },
        { text: 'some text3' },
      ]);
    });
  });

  describe('When performing metricFindQuery with $__searchFilter but no searchFilter is given', () => {
    it('should return list of all column values', async () => {
      const query = "select title from atable where title LIKE '$__searchFilter'";
      const data = {
        results: {
          tempvar: {
            meta: {
              rowCount: 3,
            },
            refId: 'tempvar',
            tables: [
              {
                columns: [{ text: 'title' }, { text: 'text' }],
                rows: [
                  ['aTitle', 'some text'],
                  ['aTitle2', 'some text2'],
                  ['aTitle3', 'some text3'],
                ],
              },
            ],
          },
        },
      };

      const { ds } = setupTestContext(data);

      const results = await ds.metricFindQuery(query, {});

      expect(fetchMock).toBeCalledTimes(1);
      expect(fetchMock.mock.calls[0][0].data.queries[0].rawSql).toBe("select title from atable where title LIKE '%'");
      expect(results).toEqual([
        { text: 'aTitle' },
        { text: 'some text' },
        { text: 'aTitle2' },
        { text: 'some text2' },
        { text: 'aTitle3' },
        { text: 'some text3' },
      ]);
    });
  });

  describe('When performing metricFindQuery with key, value columns', () => {
    it('should return list of as text, value', async () => {
      const query = 'select * from atable';
      const data = {
        results: {
          tempvar: {
            meta: {
              rowCount: 3,
            },
            refId: 'tempvar',
            tables: [
              {
                columns: [{ text: '__value' }, { text: '__text' }],
                rows: [
                  ['value1', 'aTitle'],
                  ['value2', 'aTitle2'],
                  ['value3', 'aTitle3'],
                ],
              },
            ],
          },
        },
      };

      const { ds } = setupTestContext(data);

      const results = await ds.metricFindQuery(query, {});

      expect(results).toEqual([
        { text: 'aTitle', value: 'value1' },
        { text: 'aTitle2', value: 'value2' },
        { text: 'aTitle3', value: 'value3' },
      ]);
    });
  });

  describe('When performing metricFindQuery with key, value columns and with duplicate keys', () => {
    it('should return list of unique keys', async () => {
      const query = 'select * from atable';
      const data = {
        results: {
          tempvar: {
            meta: {
              rowCount: 3,
            },
            refId: 'tempvar',
            tables: [
              {
                columns: [{ text: '__text' }, { text: '__value' }],
                rows: [
                  ['aTitle', 'same'],
                  ['aTitle', 'same'],
                  ['aTitle', 'diff'],
                ],
              },
            ],
          },
        },
      };

      const { ds } = setupTestContext(data);

      const results = await ds.metricFindQuery(query, {});

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
        expect(ds.interpolateVariable((1000 as unknown) as string, variable)).toEqual(1000);
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
      const query = {
        rawSql,
        rawQuery: true,
      };
      const { templateSrv, ds } = setupTestContext({});

      templateSrv.init([
        { type: 'query', name: 'summarize', current: { value: '1m' } },
        { type: 'query', name: 'host', current: { value: 'a' } },
      ]);

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
      const query = {
        rawSql,
        rawQuery: true,
      };
      const { templateSrv, ds } = setupTestContext({});

      templateSrv.init([
        { type: 'query', name: 'summarize', current: { value: '1m' } },
        { type: 'query', name: 'host', current: { value: 'a' } },
      ]);

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
  headers: ({} as unknown) as Headers,
  ok: true,
});
