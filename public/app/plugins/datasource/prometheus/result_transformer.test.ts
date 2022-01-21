import { DataFrame, FieldType, DataQueryRequest, DataQueryResponse, MutableDataFrame } from '@grafana/data';
import { transform, transformV2, transformDFToTable } from './result_transformer';
import { PromQuery } from './types';

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: () => ({
    replace: (str: string) => str,
  }),
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: () => {
        return { name: 'Tempo' };
      },
    };
  },
}));

const matrixResponse = {
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

describe('Prometheus Result Transformer', () => {
  describe('transformV2', () => {
    it('results with time_series format should be enriched with preferredVisualisationType', () => {
      const request = ({
        targets: [
          {
            format: 'time_series',
            refId: 'A',
          },
        ],
      } as unknown) as DataQueryRequest<PromQuery>;
      const response = ({
        state: 'Done',
        data: [
          {
            fields: [],
            length: 2,
            name: 'ALERTS',
            refId: 'A',
          },
        ],
      } as unknown) as DataQueryResponse;
      const series = transformV2(response, request, {});
      expect(series).toEqual({
        data: [{ fields: [], length: 2, meta: { preferredVisualisationType: 'graph' }, name: 'ALERTS', refId: 'A' }],
        state: 'Done',
      });
    });

    it('results with table format should be transformed to table dataFrames', () => {
      const request = ({
        targets: [
          {
            format: 'table',
            refId: 'A',
          },
        ],
      } as unknown) as DataQueryRequest<PromQuery>;
      const response = ({
        state: 'Done',
        data: [
          new MutableDataFrame({
            refId: 'A',
            fields: [
              { name: 'time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'value',
                type: FieldType.number,
                values: [6, 5, 4],
                labels: { label1: 'value1', label2: 'value2' },
              },
            ],
          }),
        ],
      } as unknown) as DataQueryResponse;
      const series = transformV2(response, request, {});

      expect(series.data[0].fields[0].name).toEqual('Time');
      expect(series.data[0].fields[1].name).toEqual('label1');
      expect(series.data[0].fields[2].name).toEqual('label2');
      expect(series.data[0].fields[3].name).toEqual('Value');
      expect(series.data[0].meta?.preferredVisualisationType).toEqual('table');
    });

    it('results with table format and multiple data frames should be transformed to 1 table dataFrame', () => {
      const request = ({
        targets: [
          {
            format: 'table',
            refId: 'A',
          },
        ],
      } as unknown) as DataQueryRequest<PromQuery>;
      const response = ({
        state: 'Done',
        data: [
          new MutableDataFrame({
            refId: 'A',
            fields: [
              { name: 'time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'value',
                type: FieldType.number,
                values: [6, 5, 4],
                labels: { label1: 'value1', label2: 'value2' },
              },
            ],
          }),
          new MutableDataFrame({
            refId: 'A',
            fields: [
              { name: 'time', type: FieldType.time, values: [2, 3, 7] },
              {
                name: 'value',
                type: FieldType.number,
                values: [2, 3, 7],
                labels: { label3: 'value3', label4: 'value4' },
              },
            ],
          }),
        ],
      } as unknown) as DataQueryResponse;
      const series = transformV2(response, request, {});

      expect(series.data.length).toEqual(1);
      expect(series.data[0].fields[0].name).toEqual('Time');
      expect(series.data[0].fields[1].name).toEqual('label1');
      expect(series.data[0].fields[2].name).toEqual('label2');
      expect(series.data[0].fields[3].name).toEqual('label3');
      expect(series.data[0].fields[4].name).toEqual('label4');
      expect(series.data[0].fields[5].name).toEqual('Value');
      expect(series.data[0].meta?.preferredVisualisationType).toEqual('table');
    });

    it('results with table and time_series format should be correctly transformed', () => {
      const options = ({
        targets: [
          {
            format: 'table',
            refId: 'A',
          },
          {
            format: 'time_series',
            refId: 'B',
          },
        ],
      } as unknown) as DataQueryRequest<PromQuery>;
      const response = ({
        state: 'Done',
        data: [
          new MutableDataFrame({
            refId: 'A',
            fields: [
              { name: 'time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'value',
                type: FieldType.number,
                values: [6, 5, 4],
                labels: { label1: 'value1', label2: 'value2' },
              },
            ],
          }),
          new MutableDataFrame({
            refId: 'B',
            fields: [
              { name: 'time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'value',
                type: FieldType.number,
                values: [6, 5, 4],
                labels: { label1: 'value1', label2: 'value2' },
              },
            ],
          }),
        ],
      } as unknown) as DataQueryResponse;
      const series = transformV2(response, options, {});
      expect(series.data[0].fields.length).toEqual(2);
      expect(series.data[0].meta?.preferredVisualisationType).toEqual('graph');
      expect(series.data[1].fields.length).toEqual(4);
      expect(series.data[1].meta?.preferredVisualisationType).toEqual('table');
    });

    it('results with heatmap format should be correctly transformed', () => {
      const options = ({
        targets: [
          {
            format: 'heatmap',
            refId: 'A',
          },
        ],
      } as unknown) as DataQueryRequest<PromQuery>;
      const response = ({
        state: 'Done',
        data: [
          new MutableDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'Value',
                type: FieldType.number,
                values: [10, 10, 0],
                labels: { le: '1' },
              },
            ],
          }),
          new MutableDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'Value',
                type: FieldType.number,
                values: [20, 10, 30],
                labels: { le: '2' },
              },
            ],
          }),
          new MutableDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'Value',
                type: FieldType.number,
                values: [30, 10, 40],
                labels: { le: '3' },
              },
            ],
          }),
        ],
      } as unknown) as DataQueryResponse;

      const series = transformV2(response, options, {});
      expect(series.data[0].fields.length).toEqual(2);
      expect(series.data[0].fields[1].values.toArray()).toEqual([10, 10, 0]);
      expect(series.data[1].fields[1].values.toArray()).toEqual([10, 0, 30]);
      expect(series.data[2].fields[1].values.toArray()).toEqual([10, 0, 10]);
    });
  });
  describe('transformDFToTable', () => {
    it('transforms dataFrame with response length 1 to table dataFrame', () => {
      const df = new MutableDataFrame({
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [6, 5, 4] },
          {
            name: 'value',
            type: FieldType.number,
            values: [6, 5, 4],
            labels: { label1: 'value1', label2: 'value2' },
          },
        ],
      });

      const tableDf = transformDFToTable([df])[0];
      expect(tableDf.fields.length).toBe(4);
      expect(tableDf.fields[0].name).toBe('Time');
      expect(tableDf.fields[1].name).toBe('label1');
      expect(tableDf.fields[1].values.get(0)).toBe('value1');
      expect(tableDf.fields[2].name).toBe('label2');
      expect(tableDf.fields[2].values.get(0)).toBe('value2');
      expect(tableDf.fields[3].name).toBe('Value');
    });

    it('transforms dataFrame with response length 2 to table dataFrame', () => {
      const df = new MutableDataFrame({
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [6, 5, 4] },
          {
            name: 'value',
            type: FieldType.number,
            values: [6, 5, 4],
            labels: { label1: 'value1', label2: 'value2' },
          },
        ],
      });

      const tableDf = transformDFToTable([df])[0];
      expect(tableDf.fields.length).toBe(4);
      expect(tableDf.fields[0].name).toBe('Time');
      expect(tableDf.fields[1].name).toBe('label1');
      expect(tableDf.fields[1].values.get(0)).toBe('value1');
      expect(tableDf.fields[2].name).toBe('label2');
      expect(tableDf.fields[2].values.get(0)).toBe('value2');
      expect(tableDf.fields[3].name).toBe('Value');
    });
  });

  describe('transform', () => {
    const options: any = { target: {}, query: {} };
    describe('When nothing is returned', () => {
      it('should return empty array', () => {
        const response = {
          status: 'success',
          data: {
            resultType: '',
            result: null,
          },
        };
        const series = transform({ data: response } as any, options);
        expect(series).toEqual([]);
      });
      it('should return empty array', () => {
        const response = {
          status: 'success',
          data: {
            resultType: '',
            result: null,
          },
        };
        const result = transform({ data: response } as any, { ...options, target: { format: 'table' } });
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
              values: [
                [1443454528, '3846'],
                [1443454530, '3848'],
              ],
            },
            {
              metric: {
                __name__: 'test2',
                instance: 'localhost:8080',
                job: 'otherjob',
              },
              values: [
                [1443454529, '3847'],
                [1443454531, '3849'],
              ],
            },
          ],
        },
      };

      it('should return data frame', () => {
        const result = transform({ data: response } as any, {
          ...options,
          target: {
            responseListLength: 0,
            refId: 'A',
            format: 'table',
          },
        });
        expect(result[0].fields[0].values.toArray()).toEqual([
          1443454528000,
          1443454530000,
          1443454529000,
          1443454531000,
        ]);
        expect(result[0].fields[0].name).toBe('Time');
        expect(result[0].fields[0].type).toBe(FieldType.time);
        expect(result[0].fields[1].values.toArray()).toEqual(['test', 'test', 'test2', 'test2']);
        expect(result[0].fields[1].name).toBe('__name__');
        expect(result[0].fields[1].config.filterable).toBe(true);
        expect(result[0].fields[1].type).toBe(FieldType.string);
        expect(result[0].fields[2].values.toArray()).toEqual(['', '', 'localhost:8080', 'localhost:8080']);
        expect(result[0].fields[2].name).toBe('instance');
        expect(result[0].fields[2].type).toBe(FieldType.string);
        expect(result[0].fields[3].values.toArray()).toEqual(['testjob', 'testjob', 'otherjob', 'otherjob']);
        expect(result[0].fields[3].name).toBe('job');
        expect(result[0].fields[3].type).toBe(FieldType.string);
        expect(result[0].fields[4].values.toArray()).toEqual([3846, 3848, 3847, 3849]);
        expect(result[0].fields[4].name).toEqual('Value');
        expect(result[0].fields[4].type).toBe(FieldType.number);
        expect(result[0].refId).toBe('A');
      });

      it('should include refId if response count is more than 2', () => {
        const result = transform({ data: response } as any, {
          ...options,
          target: {
            refId: 'B',
            format: 'table',
          },
          responseListLength: 2,
        });

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

      it('should return data frame', () => {
        const result = transform({ data: response } as any, { ...options, target: { format: 'table' } });
        expect(result[0].fields[0].values.toArray()).toEqual([1443454528000]);
        expect(result[0].fields[0].name).toBe('Time');
        expect(result[0].fields[1].values.toArray()).toEqual(['test']);
        expect(result[0].fields[1].name).toBe('__name__');
        expect(result[0].fields[2].values.toArray()).toEqual(['testjob']);
        expect(result[0].fields[2].name).toBe('job');
        expect(result[0].fields[3].values.toArray()).toEqual([3846]);
        expect(result[0].fields[3].name).toEqual('Value');
      });

      it('should return le label values parsed as numbers', () => {
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
        const result = transform({ data: response } as any, { ...options, target: { format: 'table' } });
        expect(result[0].fields[1].values.toArray()).toEqual([102]);
        expect(result[0].fields[1].type).toEqual(FieldType.number);
      });
    });

    describe('When instant = true', () => {
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

      it('should return data frame', () => {
        const result: DataFrame[] = transform({ data: response } as any, { ...options, query: { instant: true } });
        expect(result[0].name).toBe('test{job="testjob"}');
      });
    });

    describe('When resultFormat is heatmap', () => {
      const getResponse = (result: any) => ({
        status: 'success',
        data: {
          resultType: 'matrix',
          result,
        },
      });

      const options = {
        format: 'heatmap',
        start: 1445000010,
        end: 1445000030,
        legendFormat: '{{le}}',
      };

      it('should convert cumulative histogram to regular', () => {
        const response = getResponse([
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
        ]);

        const result = transform({ data: response } as any, { query: options, target: options } as any);
        expect(result[0].fields[0].values.toArray()).toEqual([1445000010000, 1445000020000, 1445000030000]);
        expect(result[0].fields[1].values.toArray()).toEqual([10, 10, 0]);
        expect(result[1].fields[0].values.toArray()).toEqual([1445000010000, 1445000020000, 1445000030000]);
        expect(result[1].fields[1].values.toArray()).toEqual([10, 0, 30]);
        expect(result[2].fields[0].values.toArray()).toEqual([1445000010000, 1445000020000, 1445000030000]);
        expect(result[2].fields[1].values.toArray()).toEqual([10, 0, 10]);
      });

      it('should handle missing datapoints', () => {
        const response = getResponse([
          {
            metric: { __name__: 'test', job: 'testjob', le: '1' },
            values: [
              [1445000010, '1'],
              [1445000020, '2'],
            ],
          },
          {
            metric: { __name__: 'test', job: 'testjob', le: '2' },
            values: [
              [1445000010, '2'],
              [1445000020, '5'],
              [1445000030, '1'],
            ],
          },
          {
            metric: { __name__: 'test', job: 'testjob', le: '3' },
            values: [
              [1445000010, '3'],
              [1445000020, '7'],
            ],
          },
        ]);
        const result = transform({ data: response } as any, { query: options, target: options } as any);
        expect(result[0].fields[1].values.toArray()).toEqual([1, 2]);
        expect(result[1].fields[1].values.toArray()).toEqual([1, 3, 1]);
        expect(result[2].fields[1].values.toArray()).toEqual([1, 2]);
      });
    });

    describe('When the response is a matrix', () => {
      it('should have labels with the value field', () => {
        const response = {
          status: 'success',
          data: {
            resultType: 'matrix',
            result: [
              {
                metric: { __name__: 'test', job: 'testjob', instance: 'testinstance' },
                values: [
                  [0, '10'],
                  [1, '10'],
                  [2, '0'],
                ],
              },
            ],
          },
        };

        const result: DataFrame[] = transform({ data: response } as any, {
          ...options,
        });

        expect(result[0].fields[1].labels).toBeDefined();
        expect(result[0].fields[1].labels?.instance).toBe('testinstance');
        expect(result[0].fields[1].labels?.job).toBe('testjob');
      });

      it('should transform into a data frame', () => {
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

        const result: DataFrame[] = transform({ data: response } as any, {
          ...options,
          query: {
            start: 0,
            end: 2,
          },
        });
        expect(result[0].fields[0].values.toArray()).toEqual([0, 1000, 2000]);
        expect(result[0].fields[1].values.toArray()).toEqual([10, 10, 0]);
        expect(result[0].name).toBe('test{job="testjob"}');
      });

      it('should fill null values', () => {
        const result = transform({ data: matrixResponse } as any, {
          ...options,
          query: { step: 1, start: 0, end: 2 },
        });

        expect(result[0].fields[0].values.toArray()).toEqual([0, 1000, 2000]);
        expect(result[0].fields[1].values.toArray()).toEqual([null, 10, 0]);
      });

      it('should use __name__ label as series name', () => {
        const result = transform({ data: matrixResponse } as any, {
          ...options,
          query: {
            step: 1,
            start: 0,
            end: 2,
          },
        });
        expect(result[0].name).toEqual('test{job="testjob"}');
      });

      it('should use query as series name when __name__ is not available and metric is empty', () => {
        const response = {
          status: 'success',
          data: {
            resultType: 'matrix',
            result: [
              {
                metric: {},
                values: [[0, '10']],
              },
            ],
          },
        };
        const expr = 'histogram_quantile(0.95, sum(rate(tns_request_duration_seconds_bucket[5m])) by (le))';
        const result = transform({ data: response } as any, {
          ...options,
          query: {
            step: 1,
            start: 0,
            end: 2,
            expr,
          },
        });
        expect(result[0].name).toEqual(expr);
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

        const result = transform({ data: response } as any, {
          ...options,
          query: {
            step: 1,
            start: 0,
            end: 2,
          },
        });
        expect(result[0].name).toBe('{job="testjob"}');
      });

      it('should not set displayName for ValueFields', () => {
        const result = transform({ data: matrixResponse } as any, options);
        expect(result[0].fields[1].config.displayName).toBeUndefined();
        expect(result[0].fields[1].config.displayNameFromDS).toBe('test{job="testjob"}');
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

        const result = transform({ data: response } as any, { ...options, query: { step: 2, start: 0, end: 8 } });
        expect(result[0].fields[0].values.toArray()).toEqual([0, 2000, 4000, 6000, 8000]);
        expect(result[0].fields[1].values.toArray()).toEqual([null, null, 10, null, 10]);
      });
    });

    describe('When infinity values are returned', () => {
      describe('When resultType is scalar', () => {
        const response = {
          status: 'success',
          data: {
            resultType: 'scalar',
            result: [1443454528, '+Inf'],
          },
        };

        it('should correctly parse values', () => {
          const result: DataFrame[] = transform({ data: response } as any, {
            ...options,
            target: { format: 'table' },
          });
          expect(result[0].fields[1].values.toArray()).toEqual([Number.POSITIVE_INFINITY]);
        });
      });

      describe('When resultType is vector', () => {
        const response = {
          status: 'success',
          data: {
            resultType: 'vector',
            result: [
              {
                metric: { __name__: 'test', job: 'testjob' },
                value: [1443454528, '+Inf'],
              },
              {
                metric: { __name__: 'test', job: 'testjob' },
                value: [1443454528, '-Inf'],
              },
            ],
          },
        };

        describe('When format is table', () => {
          it('should correctly parse values', () => {
            const result: DataFrame[] = transform({ data: response } as any, {
              ...options,
              target: { format: 'table' },
            });
            expect(result[0].fields[3].values.toArray()).toEqual([Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]);
          });
        });
      });
    });

    const exemplarsResponse = {
      status: 'success',
      data: [
        {
          seriesLabels: { __name__: 'test' },
          exemplars: [
            {
              timestamp: 1610449069.957,
              labels: { traceID: '5020b5bc45117f07' },
              value: 0.002074123,
            },
          ],
        },
      ],
    };

    describe('When the response is exemplar data', () => {
      it('should return as an data frame with a dataTopic annotations', () => {
        const result = transform({ data: exemplarsResponse } as any, options);

        expect(result[0].meta?.dataTopic).toBe('annotations');
        expect(result[0].fields.length).toBe(4); // __name__, traceID, Time, Value
        expect(result[0].length).toBe(1);
      });

      it('should return with an empty array when data is empty', () => {
        const result = transform(
          {
            data: {
              status: 'success',
              data: [],
            },
          } as any,
          options
        );

        expect(result).toHaveLength(0);
      });

      it('should remove exemplars that are too close to each other', () => {
        const response = {
          status: 'success',
          data: [
            {
              exemplars: [
                {
                  timestamp: 1610449070.0,
                  value: 5,
                },
                {
                  timestamp: 1610449070.0,
                  value: 1,
                },
                {
                  timestamp: 1610449070.5,
                  value: 13,
                },
                {
                  timestamp: 1610449070.3,
                  value: 20,
                },
              ],
            },
          ],
        };
        /**
         * the standard deviation for the above values is 8.4 this means that we show the highest
         * value (20) and then the next value should be 2 times the standard deviation which is 1
         **/
        const result = transform({ data: response } as any, options);
        expect(result[0].length).toBe(2);
      });

      describe('data link', () => {
        it('should be added to the field if found with url', () => {
          const result = transform({ data: exemplarsResponse } as any, {
            ...options,
            exemplarTraceIdDestinations: [{ name: 'traceID', url: 'http://localhost' }],
          });

          expect(result[0].fields.some((f) => f.config.links?.length)).toBe(true);
        });

        it('should be added to the field if found with internal link', () => {
          const result = transform({ data: exemplarsResponse } as any, {
            ...options,
            exemplarTraceIdDestinations: [{ name: 'traceID', datasourceUid: 'jaeger' }],
          });

          expect(result[0].fields.some((f) => f.config.links?.length)).toBe(true);
        });

        it('should not add link if exemplarTraceIdDestinations is not configured', () => {
          const result = transform({ data: exemplarsResponse } as any, options);

          expect(result[0].fields.some((f) => f.config.links?.length)).toBe(false);
        });
      });
    });
  });
});
