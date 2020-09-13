import { ResultTransformer } from './result_transformer';
import { DataQueryResponseData } from '@grafana/data';

describe('Prometheus Result Transformer', () => {
  const ctx: any = {};

  beforeEach(() => {
    ctx.templateSrv = {
      replace: (str: string) => str,
    };
    ctx.resultTransformer = new ResultTransformer(ctx.templateSrv);
  });

  describe('When nothing is returned', () => {
    test('should return empty series', () => {
      const response = {
        status: 'success',
        data: {
          resultType: '',
          result: (null as unknown) as DataQueryResponseData[],
        },
      };
      const series = ctx.resultTransformer.transform({ data: response }, {});
      expect(series).toEqual([]);
    });
    test('should return empty table', () => {
      const response = {
        status: 'success',
        data: {
          resultType: '',
          result: (null as unknown) as DataQueryResponseData[],
        },
      };
      const table = ctx.resultTransformer.transform({ data: response }, { format: 'table' });
      expect(table).toMatchObject([{ type: 'table', rows: [] }]);
    });
  });

  describe('When resultFormat is table', () => {
    const response = {
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
      const table = ctx.resultTransformer.transformMetricDataToTable(response.data.result, 0, 'A');
      expect(table.type).toBe('table');
      expect(table.rows).toEqual([
        [1443454528000, 'test', '', 'testjob', 3846],
        [1443454529000, 'test', 'localhost:8080', 'otherjob', 3847],
      ]);
      expect(table.columns).toMatchObject([
        { text: 'Time', type: 'time' },
        { text: '__name__', filterable: true },
        { text: 'instance', filterable: true },
        { text: 'job' },
        { text: 'Value' },
      ]);
      expect(table.columns[4].filterable).toBeUndefined();
      expect(table.refId).toBe('A');
    });

    it('should column title include refId if response count is more than 2', () => {
      const table = ctx.resultTransformer.transformMetricDataToTable(response.data.result, 2, 'B');
      expect(table.type).toBe('table');
      expect(table.columns).toMatchObject([
        { text: 'Time', type: 'time' },
        { text: '__name__' },
        { text: 'instance' },
        { text: 'job' },
        { text: 'Value #B' },
      ]);
    });
  });

  describe('When resultFormat is table and instant = true', () => {
    const response = {
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
      const table = ctx.resultTransformer.transformMetricDataToTable(response.data.result);
      expect(table.type).toBe('table');
      expect(table.rows).toEqual([[1443454528000, 'test', 'testjob', 3846]]);
      expect(table.columns).toMatchObject([
        { text: 'Time', type: 'time' },
        { text: '__name__' },
        { text: 'job' },
        { text: 'Value' },
      ]);
    });

    it('should return table model with le label values parsed as numbers', () => {
      const table = ctx.resultTransformer.transformMetricDataToTable([
        {
          metric: { le: '102' },
          value: [1594908838, '0'],
        },
      ]);
      expect(table.type).toBe('table');
      expect(table.rows).toEqual([[1594908838000, 102, 0]]);
    });
  });

  describe('When resultFormat is time series and instant = true', () => {
    const response = {
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

    it('should return time series', () => {
      const timeSeries = ctx.resultTransformer.transform({ data: response }, {});
      expect(timeSeries[0].target).toBe('test{job="testjob"}');
      expect(timeSeries[0].title).toBe('test{job="testjob"}');
    });
  });

  describe('When resultFormat is heatmap', () => {
    const response = {
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [
          {
            metric: { __name__: 'test', job: 'testjob', le: '1' },
            values: [
              [1445000010, '10'],
              [1445000020, '10'],
              [1445000030, '0'],
            ],
          },
          {
            metric: { __name__: 'test', job: 'testjob', le: '2' },
            values: [
              [1445000010, '20'],
              [1445000020, '10'],
              [1445000030, '30'],
            ],
          },
          {
            metric: { __name__: 'test', job: 'testjob', le: '3' },
            values: [
              [1445000010, '30'],
              [1445000020, '10'],
              [1445000030, '40'],
            ],
          },
        ],
      },
    };

    it('should convert cumulative histogram to regular', () => {
      const options = {
        format: 'heatmap',
        start: 1445000010,
        end: 1445000030,
        legendFormat: '{{le}}',
      };

      const result = ctx.resultTransformer.transform({ data: response }, options);
      expect(result).toEqual([
        {
          target: '1',
          title: '1',
          query: undefined,
          datapoints: [
            [10, 1445000010000],
            [10, 1445000020000],
            [0, 1445000030000],
          ],
          tags: { __name__: 'test', job: 'testjob', le: '1' },
        },
        {
          target: '2',
          title: '2',
          query: undefined,
          datapoints: [
            [10, 1445000010000],
            [0, 1445000020000],
            [30, 1445000030000],
          ],
          tags: { __name__: 'test', job: 'testjob', le: '2' },
        },
        {
          target: '3',
          title: '3',
          query: undefined,
          datapoints: [
            [10, 1445000010000],
            [0, 1445000020000],
            [10, 1445000030000],
          ],
          tags: { __name__: 'test', job: 'testjob', le: '3' },
        },
      ]);
    });

    it('should handle missing datapoints', () => {
      const seriesList = [
        {
          datapoints: [
            [1, 1000],
            [2, 2000],
          ],
        },
        {
          datapoints: [
            [2, 1000],
            [5, 2000],
            [1, 3000],
          ],
        },
        {
          datapoints: [
            [3, 1000],
            [7, 2000],
          ],
        },
      ];
      const expected = [
        {
          datapoints: [
            [1, 1000],
            [2, 2000],
          ],
        },
        {
          datapoints: [
            [1, 1000],
            [3, 2000],
            [1, 3000],
          ],
        },
        {
          datapoints: [
            [1, 1000],
            [2, 2000],
          ],
        },
      ];
      const result = ctx.resultTransformer.transformToHistogramOverTime(seriesList);
      expect(result).toEqual(expected);
    });

    it('should throw error when data in wrong format', () => {
      const seriesList = [{ rows: [] as any[] }, { datapoints: [] as any[] }];
      expect(() => {
        ctx.resultTransformer.transformToHistogramOverTime(seriesList);
      }).toThrow();
    });

    it('should throw error when prometheus returned non-timeseries', () => {
      // should be { metric: {}, values: [] } for timeseries
      const metricData = { metric: {}, value: [] as any[] };
      expect(() => {
        ctx.resultTransformer.transformMetricData(metricData, { step: 1 }, 1000, 2000);
      }).toThrow();
    });
  });

  describe('When resultFormat is time series', () => {
    it('should transform matrix into timeseries', () => {
      const response = {
        status: 'success',
        data: {
          resultType: 'matrix',
          result: [
            {
              metric: { __name__: 'test', job: 'testjob' },
              values: [
                [0, '10'],
                [1, '10'],
                [2, '0'],
              ],
            },
          ],
        },
      };
      const options = {
        format: 'timeseries',
        start: 0,
        end: 2,
        refId: 'B',
      };

      const result = ctx.resultTransformer.transform({ data: response }, options);
      expect(result).toEqual([
        {
          target: 'test{job="testjob"}',
          title: 'test{job="testjob"}',
          query: undefined,
          datapoints: [
            [10, 0],
            [10, 1000],
            [0, 2000],
          ],
          tags: { job: 'testjob' },
          refId: 'B',
        },
      ]);
    });

    it('should fill timeseries with null values', () => {
      const response = {
        status: 'success',
        data: {
          resultType: 'matrix',
          result: [
            {
              metric: { __name__: 'test', job: 'testjob' },
              values: [
                [1, '10'],
                [2, '0'],
              ],
            },
          ],
        },
      };
      const options = {
        format: 'timeseries',
        step: 1,
        start: 0,
        end: 2,
      };

      const result = ctx.resultTransformer.transform({ data: response }, options);
      expect(result).toEqual([
        {
          target: 'test{job="testjob"}',
          title: 'test{job="testjob"}',
          query: undefined,
          datapoints: [
            [null, 0],
            [10, 1000],
            [0, 2000],
          ],
          tags: { job: 'testjob' },
        },
      ]);
    });

    it('should use __name__ label as series name', () => {
      const response = {
        status: 'success',
        data: {
          resultType: 'matrix',
          result: [
            {
              metric: { __name__: 'test', job: 'testjob' },
              values: [
                [1, '10'],
                [2, '0'],
              ],
            },
          ],
        },
      };

      const options = {
        format: 'timeseries',
        step: 1,
        start: 0,
        end: 2,
      };

      const result = ctx.resultTransformer.transform({ data: response }, options);
      expect(result[0].target).toEqual('test{job="testjob"}');
    });

    it('should set frame name to undefined if no __name__ label but there are other labels', () => {
      const response = {
        status: 'success',
        data: {
          resultType: 'matrix',
          result: [
            {
              metric: { job: 'testjob' },
              values: [
                [1, '10'],
                [2, '0'],
              ],
            },
          ],
        },
      };

      const options = {
        format: 'timeseries',
        step: 1,
        query: 'Some query',
        start: 0,
        end: 2,
      };

      const result = ctx.resultTransformer.transform({ data: response }, options);
      expect(result[0].target).toBe('{job="testjob"}');
      expect(result[0].tags.job).toEqual('testjob');
    });

    it('should align null values with step', () => {
      const response = {
        status: 'success',
        data: {
          resultType: 'matrix',
          result: [
            {
              metric: { __name__: 'test', job: 'testjob' },
              values: [
                [4, '10'],
                [8, '10'],
              ],
            },
          ],
        },
      };
      const options = {
        format: 'timeseries',
        step: 2,
        start: 0,
        end: 8,
        refId: 'A',
        meta: { custom: { hello: '1' } },
      };

      const result = ctx.resultTransformer.transform({ data: response }, options);
      expect(result).toEqual([
        {
          target: 'test{job="testjob"}',
          title: 'test{job="testjob"}',
          meta: {
            custom: { hello: '1' },
          },
          query: undefined,
          refId: 'A',
          datapoints: [
            [null, 0],
            [null, 2000],
            [10, 4000],
            [null, 6000],
            [10, 8000],
          ],
          tags: { job: 'testjob' },
        },
      ]);
    });
  });
});
