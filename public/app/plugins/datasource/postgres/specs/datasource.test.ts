import moment from 'moment';
import { PostgresDatasource } from '../datasource';
import { CustomVariable } from 'app/features/templating/custom_variable';

describe('PostgreSQLDatasource', () => {
  const instanceSettings = { name: 'postgresql' };

  const backendSrv = {};
  const templateSrv = {
    replace: jest.fn(text => text),
  };
  const raw = {
    from: moment.utc('2018-04-25 10:00'),
    to: moment.utc('2018-04-25 11:00'),
  };
  const ctx = {
    backendSrv,
    timeSrvMock: {
      timeRange: () => ({
        from: raw.from,
        to: raw.to,
        raw: raw,
      }),
    },
  } as any;

  beforeEach(() => {
    ctx.ds = new PostgresDatasource(instanceSettings, backendSrv, {}, templateSrv, ctx.timeSrvMock);
  });

  describe('When performing annotationQuery', () => {
    let results;

    const annotationName = 'MyAnno';

    const options = {
      annotation: {
        name: annotationName,
        rawQuery: 'select time, title, text, tags from table;',
      },
      range: {
        from: moment(1432288354),
        to: moment(1432288401),
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
      ctx.backendSrv.datasourceRequest = jest.fn(options => {
        return Promise.resolve({ data: response, status: 200 });
      });
      ctx.ds.annotationQuery(options).then(data => {
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
    let results;
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
              rows: [['aTitle', 'some text'], ['aTitle2', 'some text2'], ['aTitle3', 'some text3']],
            },
          ],
        },
      },
    };

    beforeEach(() => {
      ctx.backendSrv.datasourceRequest = jest.fn(options => {
        return Promise.resolve({ data: response, status: 200 });
      });
      ctx.ds.metricFindQuery(query).then(data => {
        results = data;
      });
    });

    it('should return list of all column values', () => {
      expect(results.length).toBe(6);
      expect(results[0].text).toBe('aTitle');
      expect(results[5].text).toBe('some text3');
    });
  });

  describe('When performing metricFindQuery with key, value columns', () => {
    let results;
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
              rows: [['value1', 'aTitle'], ['value2', 'aTitle2'], ['value3', 'aTitle3']],
            },
          ],
        },
      },
    };

    beforeEach(() => {
      ctx.backendSrv.datasourceRequest = jest.fn(options => {
        return Promise.resolve({ data: response, status: 200 });
      });
      ctx.ds.metricFindQuery(query).then(data => {
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
    let results;
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
              rows: [['aTitle', 'same'], ['aTitle', 'same'], ['aTitle', 'diff']],
            },
          ],
        },
      },
    };

    beforeEach(() => {
      ctx.backendSrv.datasourceRequest = jest.fn(options => {
        return Promise.resolve({ data: response, status: 200 });
      });
      ctx.ds.metricFindQuery(query).then(data => {
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
      ctx.variable = new CustomVariable({}, {});
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
});
