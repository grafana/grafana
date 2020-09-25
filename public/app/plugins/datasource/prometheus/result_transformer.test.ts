import { DataFrame } from '@grafana/data';
import { transform } from './result_transformer';

describe('Prometheus Result Transformer', () => {
  describe('When nothing is returned', () => {
    test('should return empty series', () => {
      const response = {
        status: 'success',
        data: {
          resultType: '',
          result: null,
        },
      };
      const series = transform({ data: response } as any, {} as any);
      expect(series).toEqual([]);
    });
    test('should return empty table', () => {
      const response = {
        status: 'success',
        data: {
          resultType: '',
          result: null,
        },
      };
      const result = transform({ data: response } as any, { format: 'table' } as any);
      expect(result).toHaveLength(0);
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
              __name__: 'test2',
              instance: 'localhost:8080',
              job: 'otherjob',
            },
            values: [[1443454529, '3847']],
          },
        ],
      },
    };

    it('should return table model', () => {
      const result = transform(
        { data: response } as any,
        {
          responseListLength: 0,
          refId: 'A',
          format: 'table',
        } as any
      );
      expect(result[0].fields[0].values.toArray()).toEqual([1443454528000, 1443454529000]);
      expect(result[0].fields[0].name).toBe('Time');
      expect(result[0].fields[1].values.toArray()).toEqual(['test', 'test2']);
      expect(result[0].fields[1].name).toBe('__name__');
      expect(result[0].fields[1].config.filterable).toBe(true);
      expect(result[0].fields[2].values.toArray()).toEqual(['', 'localhost:8080']);
      expect(result[0].fields[2].name).toBe('instance');
      expect(result[0].fields[3].values.toArray()).toEqual(['testjob', 'otherjob']);
      expect(result[0].fields[3].name).toBe('job');
      expect(result[0].fields[4].values.toArray()).toEqual([3846, 3847]);
      expect(result[0].fields[4].name).toEqual('Value');
      expect(result[0].refId).toBe('A');
    });

    it('should column title include refId if response count is more than 2', () => {
      const result = transform(
        { data: response } as any,
        {
          responseListLength: 2,
          refId: 'B',
          format: 'table',
        } as any
      );

      expect(result[0].fields[4].name).toEqual('Value #B');
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
      const result = transform({ data: response } as any, { format: 'table' } as any);
      expect(result[0].fields[0].values.toArray()).toEqual([1443454528000]);
      expect(result[0].fields[0].name).toBe('Time');
      expect(result[0].fields[1].values.toArray()).toEqual(['test']);
      expect(result[0].fields[1].name).toBe('__name__');
      expect(result[0].fields[2].values.toArray()).toEqual(['testjob']);
      expect(result[0].fields[2].name).toBe('job');
      expect(result[0].fields[3].values.toArray()).toEqual([3846]);
      expect(result[0].fields[3].name).toEqual('Value');
    });

    it('should return table model with le label values parsed as numbers', () => {
      const response = {
        status: 'success',
        data: {
          resultType: 'vector',
          result: [
            {
              metric: { le: '102' },
              value: [1594908838, '0'],
            },
          ],
        },
      };
      const result = transform({ data: response } as any, { format: 'table' } as any);
      expect(result[0].fields[1].values.toArray()).toEqual([102]);
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
      const result: DataFrame[] = transform({ data: response } as any, {} as any);
      expect(result[0].name).toBe('test{job="testjob"}');
    });
  });

  // describe.skip('When resultFormat is heatmap', () => {
  //   const response = {
  //     status: 'success',
  //     data: {
  //       resultType: 'matrix',
  //       result: [
  //         {
  //           metric: { __name__: 'test', job: 'testjob', le: '1' },
  //           values: [
  //             [1445000010, '10'],
  //             [1445000020, '10'],
  //             [1445000030, '0'],
  //           ],
  //         },
  //         {
  //           metric: { __name__: 'test', job: 'testjob', le: '2' },
  //           values: [
  //             [1445000010, '20'],
  //             [1445000020, '10'],
  //             [1445000030, '30'],
  //           ],
  //         },
  //         {
  //           metric: { __name__: 'test', job: 'testjob', le: '3' },
  //           values: [
  //             [1445000010, '30'],
  //             [1445000020, '10'],
  //             [1445000030, '40'],
  //           ],
  //         },
  //       ],
  //     },
  //   };

  //   it('should convert cumulative histogram to regular', () => {
  //     const options = {
  //       format: 'heatmap',
  //       start: 1445000010,
  //       end: 1445000030,
  //       legendFormat: '{{le}}',
  //     };

  //     const result = transform({ data: response }, options);
  //     expect(result).toEqual([
  //       {
  //         target: '1',
  //         title: '1',
  //         query: undefined,
  //         datapoints: [
  //           [10, 1445000010000],
  //           [10, 1445000020000],
  //           [0, 1445000030000],
  //         ],
  //         tags: { __name__: 'test', job: 'testjob', le: '1' },
  //       },
  //       {
  //         target: '2',
  //         title: '2',
  //         query: undefined,
  //         datapoints: [
  //           [10, 1445000010000],
  //           [0, 1445000020000],
  //           [30, 1445000030000],
  //         ],
  //         tags: { __name__: 'test', job: 'testjob', le: '2' },
  //       },
  //       {
  //         target: '3',
  //         title: '3',
  //         query: undefined,
  //         datapoints: [
  //           [10, 1445000010000],
  //           [0, 1445000020000],
  //           [10, 1445000030000],
  //         ],
  //         tags: { __name__: 'test', job: 'testjob', le: '3' },
  //       },
  //     ]);
  //   });

  //   it('should handle missing datapoints', () => {
  //     const seriesList = [
  //       {
  //         datapoints: [
  //           [1, 1000],
  //           [2, 2000],
  //         ],
  //       },
  //       {
  //         datapoints: [
  //           [2, 1000],
  //           [5, 2000],
  //           [1, 3000],
  //         ],
  //       },
  //       {
  //         datapoints: [
  //           [3, 1000],
  //           [7, 2000],
  //         ],
  //       },
  //     ];
  //     const expected = [
  //       {
  //         datapoints: [
  //           [1, 1000],
  //           [2, 2000],
  //         ],
  //       },
  //       {
  //         datapoints: [
  //           [1, 1000],
  //           [3, 2000],
  //           [1, 3000],
  //         ],
  //       },
  //       {
  //         datapoints: [
  //           [1, 1000],
  //           [2, 2000],
  //         ],
  //       },
  //     ];
  //     const result = transformToHistogramOverTime(seriesList);
  //     expect(result).toEqual(expected);
  //   });

  //   it('should throw error when data in wrong format', () => {
  //     const seriesList = [{ rows: [] as any[] }, { datapoints: [] as any[] }];
  //     expect(() => {
  //       transformToHistogramOverTime(seriesList);
  //     }).toThrow();
  //   });

  //   it('should throw error when prometheus returned non-timeseries', () => {
  //     // should be { metric: {}, values: [] } for timeseries
  //     const metricData = { metric: {}, value: [] as any[] };
  //     expect(() => {
  //       transformMetricData(metricData, { step: 1 }, 1000, 2000);
  //     }).toThrow();
  //   });
  // });

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
      const options: any = {
        format: 'timeseries',
        start: 0,
        end: 2,
        refId: 'B',
      };

      const result: DataFrame[] = transform({ data: response } as any, options);
      expect(result[0].fields[0].values.toArray()).toEqual([0, 1000, 2000]);
      expect(result[0].fields[1].values.toArray()).toEqual([10, 10, 0]);
      expect(result[0].name).toBe('test{job="testjob"}');
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
      const options: any = {
        format: 'timeseries',
        step: 1,
        start: 0,
        end: 2,
      };

      const result = transform({ data: response } as any, options);

      expect(result[0].fields[0].values.toArray()).toEqual([0, 1000, 2000]);
      expect(result[0].fields[1].values.toArray()).toEqual([null, 10, 0]);
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

      const options: any = {
        format: 'timeseries',
        step: 1,
        start: 0,
        end: 2,
      };

      const result = transform({ data: response } as any, options);
      expect(result[0].name).toEqual('test{job="testjob"}');
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

      const options: any = {
        format: 'timeseries',
        step: 1,
        query: 'Some query',
        start: 0,
        end: 2,
      };

      const result = transform({ data: response } as any, options);
      expect(result[0].name).toBe('{job="testjob"}');
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
      const options: any = {
        format: 'timeseries',
        step: 2,
        start: 0,
        end: 8,
        refId: 'A',
        meta: { custom: { hello: '1' } },
      };

      const result = transform({ data: response } as any, options);
      expect(result[0].fields[0].values.toArray()).toEqual([0, 2000, 4000, 6000, 8000]);
      expect(result[0].fields[1].values.toArray()).toEqual([null, null, 10, null, 10]);
    });
  });
});
