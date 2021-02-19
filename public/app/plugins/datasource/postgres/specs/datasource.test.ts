import { PostgresDatasource } from '../datasource';
import { CustomVariable } from 'app/features/templating/custom_variable';
import { dateTime, toUtc } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { TemplateSrv } from 'app/features/templating/template_srv';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

describe('PostgreSQLDatasource', () => {
  const datasourceRequestMock = jest.spyOn(backendSrv, 'datasourceRequest');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const instanceSettings = { name: 'postgresql' };

  const templateSrv: TemplateSrv = new TemplateSrv();
  const raw = {
    from: toUtc('2018-04-25 10:00'),
    to: toUtc('2018-04-25 11:00'),
  };
  const ctx = {
    timeSrvMock: {
      timeRange: () => ({
        from: raw.from,
        to: raw.to,
        raw: raw,
      }),
    },
  } as any;

  beforeEach(() => {
    ctx.ds = new PostgresDatasource(instanceSettings, templateSrv, ctx.timeSrvMock);
  });

  describe('When performing annotationQuery', () => {
    let results: any;

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

    const response = {
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

    beforeEach(() => {
      datasourceRequestMock.mockImplementation(options => Promise.resolve({ data: response, status: 200 }));

      ctx.ds.annotationQuery(options).then((data: any) => {
        results = data;
      });
    });

    it('should return annotation list', () => {
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
    let results: any;
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

    beforeEach(() => {
      datasourceRequestMock.mockImplementation(options => Promise.resolve({ data: response, status: 200 }));

      ctx.ds.metricFindQuery(query).then((data: any) => {
        results = data;
      });
    });

    it('should return list of all column values', () => {
      expect(results.length).toBe(6);
      expect(results[0].text).toBe('aTitle');
      expect(results[5].text).toBe('some text3');
    });
  });

  describe('When performing metricFindQuery with $__searchFilter and a searchFilter is given', () => {
    let results: any;
    let calledWith: any = {};
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

    beforeEach(() => {
      datasourceRequestMock.mockImplementation(options => {
        calledWith = options;
        return Promise.resolve({ data: response, status: 200 });
      });

      ctx.ds.metricFindQuery(query, { searchFilter: 'aTit' }).then((data: any) => {
        results = data;
      });
    });

    it('should return list of all column values', () => {
      expect(datasourceRequestMock).toBeCalledTimes(1);
      expect(calledWith.data.queries[0].rawSql).toBe("select title from atable where title LIKE 'aTit%'");
      expect(results.length).toBe(6);
    });
  });

  describe('When performing metricFindQuery with $__searchFilter but no searchFilter is given', () => {
    let results: any;
    let calledWith: any = {};
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

    beforeEach(() => {
      datasourceRequestMock.mockImplementation(options => {
        calledWith = options;
        return Promise.resolve({ data: response, status: 200 });
      });

      ctx.ds.metricFindQuery(query, {}).then((data: any) => {
        results = data;
      });
    });

    it('should return list of all column values', () => {
      expect(datasourceRequestMock).toBeCalledTimes(1);
      expect(calledWith.data.queries[0].rawSql).toBe("select title from atable where title LIKE '%'");
      expect(results.length).toBe(6);
    });
  });

  describe('When performing metricFindQuery with key, value columns', () => {
    let results: any;
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

    beforeEach(() => {
      datasourceRequestMock.mockImplementation(options => Promise.resolve({ data: response, status: 200 }));

      ctx.ds.metricFindQuery(query).then((data: any) => {
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

  describe('When performing metricFindQuery with key, value columns and with duplicate keys', () => {
    let results: any;
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

    beforeEach(() => {
      datasourceRequestMock.mockImplementation(options => Promise.resolve({ data: response, status: 200 }));

      ctx.ds.metricFindQuery(query).then((data: any) => {
        results = data;
      });
      //ctx.$rootScope.$apply();
    });

    it('should return list of unique keys', () => {
      expect(results.length).toBe(1);
      expect(results[0].text).toBe('aTitle');
      expect(results[0].value).toBe('same');
    });
  });

  describe('When interpolating variables', () => {
    beforeEach(() => {
      ctx.variable = new CustomVariable({}, {} as any);
    });

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

    describe('and variable allows multi-value and is a string', () => {
      it('should return a quoted value', () => {
        ctx.variable.multi = true;
        expect(ctx.ds.interpolateVariable('abc', ctx.variable)).toEqual("'abc'");
      });
    });

    describe('and variable contains single quote', () => {
      it('should return a quoted value', () => {
        ctx.variable.multi = true;
        expect(ctx.ds.interpolateVariable("a'bc", ctx.variable)).toEqual("'a''bc'");
        expect(ctx.ds.interpolateVariable("a'b'c", ctx.variable)).toEqual("'a''b''c'");
      });
    });

    describe('and variable allows all and is a string', () => {
      it('should return a quoted value', () => {
        ctx.variable.includeAll = true;
        expect(ctx.ds.interpolateVariable('abc', ctx.variable)).toEqual("'abc'");
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
      templateSrv.init([
        { type: 'query', name: 'summarize', current: { value: '1m' } },
        { type: 'query', name: 'host', current: { value: 'a' } },
      ]);
      expect(ctx.ds.targetContainsTemplate(query)).toBeTruthy();
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
      templateSrv.init([
        { type: 'query', name: 'summarize', current: { value: '1m' } },
        { type: 'query', name: 'host', current: { value: 'a' } },
      ]);
      expect(ctx.ds.targetContainsTemplate(query)).toBeFalsy();
    });
  });
});
