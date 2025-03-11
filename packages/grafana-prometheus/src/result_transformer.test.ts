// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/result_transformer.test.ts
import {
  cacheFieldDisplayNames,
  createDataFrame,
  FieldType,
  type DataQueryRequest,
  type DataQueryResponse,
  type PreferredVisualisationType,
} from '@grafana/data';

import {
  parseSampleValue,
  sortSeriesByLabel,
  transformDFToTable,
  transformToHistogramOverTime,
  transformV2,
} from './result_transformer';
import { PromQuery } from './types';

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: () => ({
    replace: (str: string) => str,
  }),
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: (uid: string) => {
        const uids = ['Tempo', 'jaeger'];
        return uids.find((u) => u === uid) ? { name: uid } : undefined;
      },
    };
  },
}));

describe('Prometheus Result Transformer', () => {
  describe('parse variants of "+Inf" and "-Inf" strings', () => {
    it('+Inf', () => {
      expect(parseSampleValue('+Inf')).toEqual(Number.POSITIVE_INFINITY);
    });
    it('Inf', () => {
      expect(parseSampleValue('Inf')).toEqual(Number.POSITIVE_INFINITY);
    });
    it('inf', () => {
      expect(parseSampleValue('inf')).toEqual(Number.POSITIVE_INFINITY);
    });
    it('+Infinity', () => {
      expect(parseSampleValue('+Infinity')).toEqual(Number.POSITIVE_INFINITY);
    });
    it('+infinity', () => {
      expect(parseSampleValue('+infinity')).toEqual(Number.POSITIVE_INFINITY);
    });
    it('infinity', () => {
      expect(parseSampleValue('infinity')).toEqual(Number.POSITIVE_INFINITY);
    });

    it('-Inf', () => {
      expect(parseSampleValue('-Inf')).toEqual(Number.NEGATIVE_INFINITY);
    });

    it('-inf', () => {
      expect(parseSampleValue('-inf')).toEqual(Number.NEGATIVE_INFINITY);
    });

    it('-Infinity', () => {
      expect(parseSampleValue('-Infinity')).toEqual(Number.NEGATIVE_INFINITY);
    });

    it('-infinity', () => {
      expect(parseSampleValue('-infinity')).toEqual(Number.NEGATIVE_INFINITY);
    });
  });

  describe('sortSeriesByLabel() should use frame.fields[1].state?.displayName when available', () => {
    let frames = [
      createDataFrame({
        refId: 'A',
        fields: [
          { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
          {
            type: FieldType.number,
            values: [4, 5, 6],
            config: {
              displayNameFromDS: '2',
            },
            labels: {
              offset_days: '2',
            },
          },
        ],
      }),
      createDataFrame({
        refId: 'A',
        fields: [
          { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
          {
            type: FieldType.number,
            values: [7, 8, 9],
            config: {
              displayNameFromDS: '1',
            },
            labels: {
              offset_days: '1',
            },
          },
        ],
      }),
    ];

    it('sorts by displayNameFromDS', () => {
      cacheFieldDisplayNames(frames);

      let sorted = frames.slice().sort(sortSeriesByLabel);

      expect(sorted[0]).toEqual(frames[1]);
      expect(sorted[1]).toEqual(frames[0]);
    });
  });

  describe('transformV2', () => {
    it('results with time_series format should be enriched with preferredVisualisationType', () => {
      const request = {
        targets: [
          {
            format: 'time_series',
            refId: 'A',
          },
        ],
      } as unknown as DataQueryRequest<PromQuery>;
      const response = {
        state: 'Done',
        data: [
          {
            fields: [],
            length: 2,
            name: 'ALERTS',
            refId: 'A',
          },
        ],
      } as unknown as DataQueryResponse;
      const series = transformV2(response, request, {});
      expect(series).toEqual({
        data: [{ fields: [], length: 2, meta: { preferredVisualisationType: 'graph' }, name: 'ALERTS', refId: 'A' }],
        state: 'Done',
      });
    });

    it('dataplane handling, adds displayNameFromDs from calculateFieldDisplayName() when __name__ is the field name when legendFormat is auto', () => {
      const request = {
        targets: [
          {
            format: 'time_series',
            refId: 'A',
            legendFormat: '__auto',
          },
        ],
      } as unknown as DataQueryRequest<PromQuery>;
      const response = {
        state: 'Done',
        data: [
          {
            fields: [
              {
                name: 'Time',
                type: 'time',
                values: [1],
                typeInfo: { frame: 'time.Time' },
              },
              {
                name: 'up',
                labels: { __name__: 'up' },
                config: {},
                values: [1],
              },
            ],
            length: 1,
            refId: 'A',
            meta: {
              type: 'timeseries-multi',
              typeVersion: [0, 1],
            },
          },
        ],
      } as unknown as DataQueryResponse;
      const series = transformV2(response, request, {});
      expect(series).toEqual({
        data: [
          {
            fields: [
              {
                name: 'Time',
                type: 'time',
                values: [1],
                typeInfo: { frame: 'time.Time' },
              },
              {
                config: { displayNameFromDS: 'up' },
                labels: { __name__: 'up' },
                name: 'up',
                values: [1],
              },
            ],
            length: 1,
            meta: {
              type: 'timeseries-multi',
              typeVersion: [0, 1],
              preferredVisualisationType: 'graph',
            },
            refId: 'A',
          },
        ],
        state: 'Done',
      });
    });

    it('results with table format should be transformed to table dataFrames', () => {
      const request = {
        targets: [
          {
            format: 'table',
            refId: 'A',
          },
        ],
      } as unknown as DataQueryRequest<PromQuery>;
      const response = {
        state: 'Done',
        data: [
          createDataFrame({
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
      } as unknown as DataQueryResponse;
      const series = transformV2(response, request, {});

      expect(series.data[0].fields[0].name).toEqual('Time');
      expect(series.data[0].fields[1].name).toEqual('label1');
      expect(series.data[0].fields[2].name).toEqual('label2');
      expect(series.data[0].fields[3].name).toEqual('Value');
      expect(series.data[0].meta?.preferredVisualisationType).toEqual('rawPrometheus');
    });

    it('results with table format and multiple data frames should be transformed to 1 table dataFrame', () => {
      const request = {
        targets: [
          {
            format: 'table',
            refId: 'A',
          },
        ],
      } as unknown as DataQueryRequest<PromQuery>;
      const response = {
        state: 'Done',
        data: [
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'time', type: FieldType.time, values: [4, 5, 6] },
              {
                name: 'value',
                type: FieldType.number,
                values: [4, 5, 6],
                labels: { label1: 'value1', label2: 'value2' },
              },
            ],
          }),
          createDataFrame({
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
      } as unknown as DataQueryResponse;
      const series = transformV2(response, request, {});

      expect(series.data.length).toEqual(1);
      expect(series.data[0].fields[0].name).toEqual('Time');
      expect(series.data[0].fields[0].values).toEqual([2, 3, 4, 5, 6, 7]);
      expect(series.data[0].fields[1].name).toEqual('label1');
      expect(series.data[0].fields[2].name).toEqual('label2');
      expect(series.data[0].fields[3].name).toEqual('label3');
      expect(series.data[0].fields[4].name).toEqual('label4');
      expect(series.data[0].fields[5].name).toEqual('Value');
      expect(series.data[0].fields[5].values).toEqual([2, 3, 4, 5, 6, 7]);
      expect(series.data[0].meta?.preferredVisualisationType).toEqual('rawPrometheus' as PreferredVisualisationType);
    });

    it('results with table and time_series format should be correctly transformed', () => {
      const options = {
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
      } as unknown as DataQueryRequest<PromQuery>;
      const response = {
        state: 'Done',
        data: [
          createDataFrame({
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
          createDataFrame({
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
      } as unknown as DataQueryResponse;
      const series = transformV2(response, options, {});
      expect(series.data[0].fields.length).toEqual(2);
      expect(series.data[0].meta?.preferredVisualisationType).toEqual('graph');
      expect(series.data[1].fields.length).toEqual(4);
      expect(series.data[1].meta?.preferredVisualisationType).toEqual('rawPrometheus' as PreferredVisualisationType);
    });

    it('histogram results with table format have le values as strings for table filtering', () => {
      const options = {
        targets: [
          {
            format: 'table',
            refId: 'A',
          },
        ],
      } as unknown as DataQueryRequest<PromQuery>;
      const response = {
        state: 'Done',
        data: [
          createDataFrame({
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
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'Value',
                type: FieldType.number,
                values: [30, 10, 40],
                labels: { le: '+Inf' },
              },
            ],
          }),
          createDataFrame({
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
        ],
      } as unknown as DataQueryResponse;

      const series = transformV2(response, options, {});
      const leFields = series.data[0].fields.filter((f) => f.name === 'le');
      const leValuesAreStrings = leFields[0].values.every((v) => typeof v === 'string');
      expect(leValuesAreStrings).toBe(true);
    });
    // Heatmap frames can either have a name of the metric, or if there is no metric, a name of "Value"
    it('results with heatmap format (no metric name) should be correctly transformed', () => {
      const options = {
        targets: [
          {
            format: 'heatmap',
            refId: 'A',
          },
        ],
      } as unknown as DataQueryRequest<PromQuery>;
      const response = {
        state: 'Done',
        data: [
          createDataFrame({
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
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'Value',
                type: FieldType.number,
                values: [30, 10, 40],
                labels: { le: '+Inf' },
              },
            ],
          }),
          createDataFrame({
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
        ],
      } as unknown as DataQueryResponse;

      const series = transformV2(response, options, {});
      expect(series.data[0].fields.length).toEqual(4);
      expect(series.data[0].fields[1].values).toEqual([10, 10, 0]);
      expect(series.data[0].fields[2].values).toEqual([10, 0, 30]);
      expect(series.data[0].fields[3].values).toEqual([10, 0, 10]);
      expect(series.data[0].fields[1].name).toEqual('1');
      expect(series.data[0].fields[2].name).toEqual('2');
      expect(series.data[0].fields[3].name).toEqual('+Inf');
    });

    it('results with heatmap format (with metric name) should be correctly transformed', () => {
      const options = {
        targets: [
          {
            format: 'heatmap',
            refId: 'A',
          },
        ],
      } as unknown as DataQueryRequest<PromQuery>;
      const response = {
        state: 'Done',
        data: [
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'metric_name',
                type: FieldType.number,
                values: [10, 10, 0],
                labels: { le: '1', __name__: 'metric_name' },
              },
            ],
          }),
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'metric_name',
                type: FieldType.number,
                values: [30, 10, 40],
                labels: { le: '+Inf', __name__: 'metric_name' },
              },
            ],
          }),
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'metric_name',
                type: FieldType.number,
                values: [20, 10, 30],
                labels: { le: '2', __name__: 'metric_name' },
              },
            ],
          }),
        ],
      } as unknown as DataQueryResponse;

      const series = transformV2(response, options, {});
      expect(series.data[0].fields.length).toEqual(4);
      expect(series.data[0].fields[1].values).toEqual([10, 10, 0]);
      expect(series.data[0].fields[2].values).toEqual([10, 0, 30]);
      expect(series.data[0].fields[3].values).toEqual([10, 0, 10]);
      expect(series.data[0].fields[1].name).toEqual('1');
      expect(series.data[0].fields[2].name).toEqual('2');
      expect(series.data[0].fields[3].name).toEqual('+Inf');
    });

    it('results with heatmap format (no metric name) from multiple queries should be correctly transformed', () => {
      const options = {
        targets: [
          {
            format: 'heatmap',
            refId: 'A',
          },
          {
            format: 'heatmap',
            refId: 'B',
          },
        ],
      } as unknown as DataQueryRequest<PromQuery>;
      const response = {
        state: 'Done',
        data: [
          createDataFrame({
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
          createDataFrame({
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
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'Value',
                type: FieldType.number,
                values: [30, 10, 40],
                labels: { le: '+Inf' },
              },
            ],
          }),
          createDataFrame({
            refId: 'B',
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
          createDataFrame({
            refId: 'B',
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
          createDataFrame({
            refId: 'B',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'Value',
                type: FieldType.number,
                values: [30, 10, 40],
                labels: { le: '+Inf' },
              },
            ],
          }),
        ],
      } as unknown as DataQueryResponse;

      const series = transformV2(response, options, {});
      expect(series.data[0].fields.length).toEqual(4);
      expect(series.data[0].fields[1].values).toEqual([10, 10, 0]);
      expect(series.data[0].fields[2].values).toEqual([10, 0, 30]);
      expect(series.data[0].fields[3].values).toEqual([10, 0, 10]);
    });
    it('results with heatmap format (with metric name) from multiple queries should be correctly transformed', () => {
      const options = {
        targets: [
          {
            format: 'heatmap',
            refId: 'A',
          },
          {
            format: 'heatmap',
            refId: 'B',
          },
        ],
      } as unknown as DataQueryRequest<PromQuery>;
      const response = {
        state: 'Done',
        data: [
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'metric_name',
                type: FieldType.number,
                values: [10, 10, 0],
                labels: { le: '1', __name__: 'metric_name' },
              },
            ],
          }),
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'metric_name',
                type: FieldType.number,
                values: [20, 10, 30],
                labels: { le: '2', __name__: 'metric_name' },
              },
            ],
          }),
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'metric_name',
                type: FieldType.number,
                values: [30, 10, 40],
                labels: { le: '+Inf', __name__: 'metric_name' },
              },
            ],
          }),
          createDataFrame({
            refId: 'B',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'metric_name',
                type: FieldType.number,
                values: [10, 10, 0],
                labels: { le: '1', __name__: 'metric_name' },
              },
            ],
          }),
          createDataFrame({
            refId: 'B',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'metric_name',
                type: FieldType.number,
                values: [20, 10, 30],
                labels: { le: '2', __name__: 'metric_name' },
              },
            ],
          }),
          createDataFrame({
            refId: 'B',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'metric_name',
                type: FieldType.number,
                values: [30, 10, 40],
                labels: { le: '+Inf', __name__: 'metric_name' },
              },
            ],
          }),
        ],
      } as unknown as DataQueryResponse;

      const series = transformV2(response, options, {});
      expect(series.data[0].fields.length).toEqual(4);
      expect(series.data[0].fields[1].values).toEqual([10, 10, 0]);
      expect(series.data[0].fields[2].values).toEqual([10, 0, 30]);
      expect(series.data[0].fields[3].values).toEqual([10, 0, 10]);
    });

    it('results with heatmap format and multiple histograms should be grouped and de-accumulated by non-le labels', () => {
      const options = {
        targets: [
          {
            format: 'heatmap',
            refId: 'A',
          },
        ],
      } as unknown as DataQueryRequest<PromQuery>;
      const response = {
        state: 'Done',
        data: [
          // 10
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'Value',
                type: FieldType.number,
                values: [10, 10, 0],
                labels: { le: '1', additionalProperty: '10' },
              },
            ],
          }),
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'Value',
                type: FieldType.number,
                values: [20, 10, 30],
                labels: { le: '2', additionalProperty: '10' },
              },
            ],
          }),
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'Value',
                type: FieldType.number,
                values: [30, 10, 40],
                labels: { le: '+Inf', additionalProperty: '10' },
              },
            ],
          }),
          // 20
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'Value',
                type: FieldType.number,
                values: [0, 10, 10],
                labels: { le: '1', additionalProperty: '20' },
              },
            ],
          }),
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'Value',
                type: FieldType.number,
                values: [20, 10, 40],
                labels: { le: '2', additionalProperty: '20' },
              },
            ],
          }),
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'Value',
                type: FieldType.number,
                values: [30, 10, 60],
                labels: { le: '+Inf', additionalProperty: '20' },
              },
            ],
          }),
          // 30
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'Value',
                type: FieldType.number,
                values: [30, 30, 60],
                labels: { le: '1', additionalProperty: '30' },
              },
            ],
          }),
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'Value',
                type: FieldType.number,
                values: [30, 40, 60],
                labels: { le: '2', additionalProperty: '30' },
              },
            ],
          }),
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              {
                name: 'Value',
                type: FieldType.number,
                values: [40, 40, 60],
                labels: { le: '+Inf', additionalProperty: '30' },
              },
            ],
          }),
        ],
      } as unknown as DataQueryResponse;

      const series = transformV2(response, options, {});
      expect(series.data[0].fields.length).toEqual(4);
      expect(series.data[0].fields[1].values).toEqual([10, 10, 0]);
      expect(series.data[0].fields[2].values).toEqual([10, 0, 30]);
      expect(series.data[0].fields[3].values).toEqual([10, 0, 10]);

      expect(series.data[1].fields[1].values).toEqual([0, 10, 10]);
      expect(series.data[1].fields[2].values).toEqual([20, 0, 30]);
      expect(series.data[1].fields[3].values).toEqual([10, 0, 20]);

      expect(series.data[2].fields[1].values).toEqual([30, 30, 60]);
      expect(series.data[2].fields[2].values).toEqual([0, 10, 0]);
      expect(series.data[2].fields[3].values).toEqual([10, 0, 0]);
    });

    it('Retains exemplar frames when data returned is a heatmap', () => {
      const options = {
        targets: [
          {
            format: 'heatmap',
            refId: 'A',
          },
        ],
      } as unknown as DataQueryRequest<PromQuery>;
      const response = {
        state: 'Done',
        data: [
          createDataFrame({
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
          createDataFrame({
            refId: 'A',
            name: 'exemplar',
            meta: {
              custom: {
                resultType: 'exemplar',
              },
            },
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4, 3, 2, 1] },
              {
                name: 'Value',
                type: FieldType.number,
                values: [30, 10, 40, 90, 14, 21],
                labels: { le: '6' },
              },
              {
                name: 'Test',
                type: FieldType.string,
                values: ['hello', 'doctor', 'name', 'continue', 'yesterday', 'tomorrow'],
                labels: { le: '6' },
              },
            ],
          }),
        ],
      } as unknown as DataQueryResponse;

      const series = transformV2(response, options, {});
      expect(series.data[0].fields.length).toEqual(2);
      expect(series.data.length).toEqual(2);
      expect(series.data[1].fields[2].values).toEqual(['hello', 'doctor', 'name', 'continue', 'yesterday', 'tomorrow']);
      expect(series.data[1].fields.length).toEqual(3);
    });

    it('should not add a link with an error when exemplarTraceIdDestinations is not configured properly', () => {
      const response = {
        state: 'Done',
        data: [
          createDataFrame({
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
          createDataFrame({
            refId: 'A',
            name: 'exemplar',
            meta: {
              custom: {
                resultType: 'exemplar',
              },
            },
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4, 3, 2, 1] },
              {
                name: 'Value',
                type: FieldType.number,
                values: [30, 10, 40, 90, 14, 21],
                labels: { le: '6' },
              },
              {
                name: 'traceID',
                type: FieldType.string,
                values: ['unknown'],
                labels: { le: '6' },
              },
            ],
          }),
        ],
      } as unknown as DataQueryResponse;
      const request = {
        targets: [
          {
            format: 'heatmap',
            refId: 'A',
          },
        ],
      } as unknown as DataQueryRequest<PromQuery>;
      const testOptions = {
        exemplarTraceIdDestinations: [
          {
            name: 'traceID',
            datasourceUid: 'unknown',
          },
        ],
      };

      const series = transformV2(response, request, testOptions);
      expect(series.data[1].fields.length).toEqual(3);
      expect(series.data[1].name).toEqual('exemplar');
      const traceField = series.data[1].fields.find((f) => f.name === 'traceID');
      expect(traceField).toBeDefined();
      expect(traceField!.config.links?.length).toBe(0);
    });

    it('should convert values less than 1e-9 to 0', () => {
      // pulled from real response
      const bucketValues = [
        [0.22222222222222218, 0.24444444444444444, 0.19999999999999996], // le=0.005
        [0.39999999999999997, 0.44444444444444436, 0.42222222222222217],
        [0.3999999999999999, 0.44444444444444436, 0.42222222222222217],
        [0.3999999999999999, 0.44444444444444436, 0.42222222222222217],
        [0.3999999999999999, 0.44444444444444436, 0.42222222222222217],
        [0.3999999999999999, 0.44444444444444436, 0.42222222222222217],
        [0.39999999999999997, 0.44444444444444436, 0.42222222222222217],
        [0.39999999999999997, 0.44444444444444436, 0.42222222222222217],
        [0.3999999999999999, 0.44444444444444436, 0.42222222222222217],
        [0.3999999999999999, 0.44444444444444436, 0.42222222222222217],
        [0.3999999999999999, 0.44444444444444436, 0.42222222222222217],
        [0.4666666666666666, 0.5111111111111111, 0.4888888888888888],
        [0.4666666666666666, 0.5111111111111111, 0.4888888888888888],
        [0.46666666666666656, 0.5111111111111111, 0.4888888888888888],
        [0.46666666666666656, 0.5111111111111111, 0.4888888888888888], // le=+Inf
      ];

      const frames = bucketValues.map((vals) =>
        createDataFrame({
          refId: 'A',
          fields: [
            { type: FieldType.time, values: [1, 2, 3] },
            {
              type: FieldType.number,
              values: vals.slice(),
            },
          ],
        })
      );

      const fieldValues = transformToHistogramOverTime(frames).map((frame) => frame.fields[1].values);

      expect(fieldValues).toEqual([
        [0.22222222222222218, 0.24444444444444444, 0.19999999999999996],
        [0.17777777777777778, 0.19999999999999993, 0.2222222222222222],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0.06666666666666671, 0.06666666666666671, 0.06666666666666665],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ]);
    });

    it('should throw an error if the series does not contain number-type values', () => {
      const response = {
        state: 'Done',
        data: [
          ['10', '10', '0'],
          ['20', '10', '30'],
          ['20', '10', '35'],
        ].map((values) =>
          createDataFrame({
            refId: 'A',
            fields: [
              { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
              { name: 'Value', type: FieldType.string, values },
            ],
          })
        ),
      } as unknown as DataQueryResponse;
      const request = {
        targets: [
          {
            format: 'heatmap',
            refId: 'A',
          },
        ],
      } as unknown as DataQueryRequest<PromQuery>;

      expect(() => transformV2(response, request, {})).toThrow();
    });
  });

  describe('transformDFToTable', () => {
    it('transforms dataFrame with response length 1 to table dataFrame', () => {
      const df = createDataFrame({
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
      expect(tableDf.fields[1].values[0]).toBe('value1');
      expect(tableDf.fields[2].name).toBe('label2');
      expect(tableDf.fields[2].values[0]).toBe('value2');
      expect(tableDf.fields[3].name).toBe('Value');
    });

    it('transforms dataFrame with response length 2 to table dataFrame', () => {
      const df = createDataFrame({
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
      expect(tableDf.fields[1].values[0]).toBe('value1');
      expect(tableDf.fields[2].name).toBe('label2');
      expect(tableDf.fields[2].values[0]).toBe('value2');
      expect(tableDf.fields[3].name).toBe('Value');
    });

    // Queries do not always return results
    it('transforms dataFrame and empty dataFrame mock responses to table dataFrames', () => {
      const value1 = 'value1';
      const value2 = 'value2';

      const dataframes = [
        createDataFrame({
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [6, 5, 4] },
            {
              name: 'value',
              type: FieldType.number,
              values: [6, 5, 4],
              labels: { label1: value1, label2: value2 },
            },
          ],
        }),
        createDataFrame({
          refId: 'B',
          fields: [],
        }),
      ];

      const transformedTableDataFrames = transformDFToTable(dataframes);
      // Expect the first query to still return valid results
      expect(transformedTableDataFrames[0].fields.length).toBe(4);
      expect(transformedTableDataFrames[0].fields[0].name).toBe('Time');
      expect(transformedTableDataFrames[0].fields[1].name).toBe('label1');
      expect(transformedTableDataFrames[0].fields[1].values[0]).toBe(value1);
      expect(transformedTableDataFrames[0].fields[2].name).toBe('label2');
      expect(transformedTableDataFrames[0].fields[2].values[0]).toBe(value2);
      expect(transformedTableDataFrames[0].fields[3].name).toBe('Value #A');

      // Expect the invalid/empty results not to throw an error and to return empty arrays
      expect(transformedTableDataFrames[1].fields[1].labels).toBe(undefined);
      expect(transformedTableDataFrames[1].fields[1].name).toBe('Value #B');
      expect(transformedTableDataFrames[1].fields[1].values).toEqual([]);
      expect(transformedTableDataFrames[1].fields[0].values).toEqual([]);
    });

    it('transforms dataframes with metadata resolving from their refIds', () => {
      const value1 = 'value1';
      const value2 = 'value2';
      const executedQueryForRefA = 'Expr: avg_over_time(access_evaluation_duration_bucket[15s])\nStep: 15s';
      const executedQueryForRefB = 'Expr: avg_over_time(access_evaluation_duration_bucket[5m])\nStep: 15s';

      const dataframes = [
        createDataFrame({
          refId: 'A',
          meta: {
            typeVersion: [0, 1],
            custom: {
              resultType: 'vector',
            },
            executedQueryString: executedQueryForRefA,
          },
          fields: [
            { name: 'time', type: FieldType.time, values: [6, 5, 4] },
            {
              name: 'value',
              type: FieldType.number,
              values: [6, 5, 4],
              labels: { label1: value1, label2: value2 },
            },
          ],
        }),
        createDataFrame({
          refId: 'B',
          meta: {
            typeVersion: [0, 1],
            custom: {
              resultType: 'vector',
            },
            executedQueryString: executedQueryForRefB,
          },
          fields: [
            { name: 'time', type: FieldType.time, values: [6, 5, 4] },
            {
              name: 'value',
              type: FieldType.number,
              values: [6, 5, 4],
              labels: { label1: value1, label2: value2 },
            },
          ],
        }),
      ];

      const transformedTableDataFrames = transformDFToTable(dataframes);
      expect(transformedTableDataFrames[0].meta).toBeTruthy();
      expect(transformedTableDataFrames[1].meta).toBeTruthy();
      expect(transformedTableDataFrames[0].meta?.executedQueryString).toEqual(executedQueryForRefA);
      expect(transformedTableDataFrames[1].meta?.executedQueryString).toEqual(executedQueryForRefB);
    });
  });

  it("transforms dataFrame and retains time field's `config.interval`", () => {
    const df = createDataFrame({
      refId: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3], config: { interval: 1 } },
        {
          name: 'value',
          type: FieldType.number,
          values: [5, 10, 5],
        },
      ],
    });

    const tableDf = transformDFToTable([df])[0];
    expect(tableDf.fields[0].config.interval).toEqual(1);
  });
});
