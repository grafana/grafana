import { of } from 'rxjs';
import { dateTime, toUtc } from '@grafana/data';

import { MysqlDatasource } from '../datasource';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { TemplateSrv } from 'app/features/templating/template_srv';
import { initialCustomVariableModelState } from '../../../../features/variables/custom/reducer';
import { FetchResponse } from '@grafana/runtime';

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => backendSrv,
}));

describe('MySQLDatasource', () => {
  const fetchMock = jest.spyOn(backendSrv, 'fetch');
  const setupTextContext = (response: any) => {
    const instanceSettings = { name: 'mysql' };
    const templateSrv: TemplateSrv = new TemplateSrv();
    const raw = {
      from: toUtc('2018-04-25 10:00'),
      to: toUtc('2018-04-25 11:00'),
    };
    const timeSrvMock: any = {
      timeRange: () => ({
        from: raw.from,
        to: raw.to,
        raw: raw,
      }),
    };
    const variable = { ...initialCustomVariableModelState };

    jest.clearAllMocks();
    fetchMock.mockImplementation(options => of(createFetchResponse(response)));

    const ds = new MysqlDatasource(instanceSettings, templateSrv, timeSrvMock);

    return { ds, variable, templateSrv };
  };

  describe('When performing annotationQuery', () => {
    const annotationName = 'MyAnno';

    const options = {
      annotation: {
        name: annotationName,
        rawQuery: 'select time_sec, text, tags from table;',
      },
      range: {
        from: dateTime(1432288354),
        to: dateTime(1432288401),
      },
    };

    const response = {
      results: {
        MyAnno: {
          refId: annotationName,
          tables: [
            {
              columns: [{ text: 'time_sec' }, { text: 'text' }, { text: 'tags' }],
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

    it('should return annotation list', async () => {
      const { ds } = setupTextContext(response);
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
    const query = 'select * from atable';
    const response = {
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

    it('should return list of all column values', async () => {
      const { ds } = setupTextContext(response);
      const results = await ds.metricFindQuery(query, {});

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

    it('should return list of all column values', async () => {
      const { ds } = setupTextContext(response);
      const results = await ds.metricFindQuery(query, { searchFilter: 'aTit' });

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

    it('should return list of all column values', async () => {
      const { ds } = setupTextContext(response);
      const results = await ds.metricFindQuery(query, {});

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

    it('should return list of as text, value', async () => {
      const { ds } = setupTextContext(response);
      const results = await ds.metricFindQuery(query, {});

      expect(results.length).toBe(3);
      expect(results[0].text).toBe('aTitle');
      expect(results[0].value).toBe('value1');
      expect(results[2].text).toBe('aTitle3');
      expect(results[2].value).toBe('value3');
    });
  });

  describe('When performing metricFindQuery with key, value columns and with duplicate keys', () => {
    const query = 'select * from atable';
    const response = {
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

    it('should return list of unique keys', async () => {
      const { ds } = setupTextContext(response);
      const results = await ds.metricFindQuery(query, {});

      expect(results.length).toBe(1);
      expect(results[0].text).toBe('aTitle');
      expect(results[0].value).toBe('same');
    });
  });

  describe('When interpolating variables', () => {
    describe('and value is a string', () => {
      it('should return an unquoted value', () => {
        const { ds, variable } = setupTextContext({});
        expect(ds.interpolateVariable('abc', variable)).toEqual('abc');
      });
    });

    describe('and value is a number', () => {
      it('should return an unquoted value', () => {
        const { ds, variable } = setupTextContext({});
        expect(ds.interpolateVariable(1000, variable)).toEqual(1000);
      });
    });

    describe('and value is an array of strings', () => {
      it('should return comma separated quoted values', () => {
        const { ds, variable } = setupTextContext({});
        expect(ds.interpolateVariable(['a', 'b', 'c'], variable)).toEqual("'a','b','c'");
      });
    });

    describe('and variable allows multi-value and value is a string', () => {
      it('should return a quoted value', () => {
        const { ds, variable } = setupTextContext({});
        variable.multi = true;
        expect(ds.interpolateVariable('abc', variable)).toEqual("'abc'");
      });
    });

    describe('and variable contains single quote', () => {
      it('should return a quoted value', () => {
        const { ds, variable } = setupTextContext({});
        variable.multi = true;
        expect(ds.interpolateVariable("a'bc", variable)).toEqual("'a''bc'");
      });
    });

    describe('and variable allows all and value is a string', () => {
      it('should return a quoted value', () => {
        const { ds, variable } = setupTextContext({});
        variable.includeAll = true;
        expect(ds.interpolateVariable('abc', variable)).toEqual("'abc'");
      });
    });
  });

  describe('targetContainsTemplate', () => {
    it('given query that contains template variable it should return true', () => {
      const { ds, templateSrv } = setupTextContext({});
      const rawSql = `SELECT
      $__timeGroup(createdAt,'$summarize') as time_sec,
      avg(value) as value,
      hostname as metric
    FROM
      grafana_metric
    WHERE
      $__timeFilter(createdAt) AND
      measurement = 'logins.count' AND
      hostname IN($host)
    GROUP BY 1, 3
    ORDER BY 1`;
      const query = {
        rawSql,
        rawQuery: true,
      };
      templateSrv.init([
        { type: 'query', name: 'summarize', current: { value: '1m' } },
        { type: 'query', name: 'host', current: { value: 'a' } },
      ]);
      expect(ds.targetContainsTemplate(query)).toBeTruthy();
    });

    it('given query that only contains global template variable it should return false', () => {
      const { ds, templateSrv } = setupTextContext({});
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
      };
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
