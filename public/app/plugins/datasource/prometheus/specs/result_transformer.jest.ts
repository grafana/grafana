import { ResultTransformer } from '../result_transformer';

describe('Prometheus Result Transformer', () => {
  let ctx: any = {};

  beforeEach(() => {
    ctx.templateSrv = {
      replace: str => str,
    };
    ctx.resultTransformer = new ResultTransformer(ctx.templateSrv);
  });

  describe('When resultFormat is table', () => {
    var response = {
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [
          {
            metric: { __name__: 'test', job: 'testjob' },
            values: [[1443454528, '3846']],
          },
          {
            metric: {
              __name__: 'test',
              instance: 'localhost:8080',
              job: 'otherjob',
            },
            values: [[1443454529, '3847']],
          },
        ],
      },
    };

    it('should return table model', () => {
      var table = ctx.resultTransformer.transformMetricDataToTable(response.data.result);
      expect(table.type).toBe('table');
      expect(table.rows).toEqual([
        [1443454528000, 'test', '', 'testjob', 3846],
        [1443454529000, 'test', 'localhost:8080', 'otherjob', 3847],
      ]);
      expect(table.columns).toEqual([
        { text: 'Time', type: 'time' },
        { text: '__name__' },
        { text: 'instance' },
        { text: 'job' },
        { text: 'Value' },
      ]);
    });
  });

  describe('When resultFormat is table and instant = true', () => {
    var response = {
      status: 'success',
      data: {
        resultType: 'vector',
        result: [
          {
            metric: { __name__: 'test', job: 'testjob' },
            value: [1443454528, '3846'],
          },
        ],
      },
    };

    it('should return table model', () => {
      var table = ctx.resultTransformer.transformMetricDataToTable(response.data.result);
      expect(table.type).toBe('table');
      expect(table.rows).toEqual([[1443454528000, 'test', 'testjob', 3846]]);
      expect(table.columns).toEqual([
        { text: 'Time', type: 'time' },
        { text: '__name__' },
        { text: 'job' },
        { text: 'Value' },
      ]);
    });
  });
});
