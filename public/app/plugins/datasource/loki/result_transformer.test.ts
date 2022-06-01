import { CircularDataFrame, FieldCache, FieldType, MutableDataFrame } from '@grafana/data';
import { setTemplateSrv } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';

import * as ResultTransformer from './result_transformer';
import {
  LokiStreamResult,
  LokiTailResponse,
  LokiStreamResponse,
  LokiResultType,
  TransformerOptions,
  LokiMatrixResult,
} from './types';

const streamResult: LokiStreamResult[] = [
  {
    stream: {
      foo: 'bar',
    },
    values: [['1579857562021616000', "foo: [32m'bar'[39m"]],
  },
  {
    stream: {
      bar: 'foo',
    },
    values: [['1579857562031616000', "bar: 'foo'"]],
  },
];

const lokiResponse: LokiStreamResponse = {
  status: 'success',
  data: {
    result: streamResult,
    resultType: LokiResultType.Stream,
    stats: {
      summary: {
        bytesTotal: 900,
      },
    },
  },
};

jest.mock('@grafana/runtime', () => ({
  // @ts-ignore
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: () => {
        return { name: 'Loki1' };
      },
    };
  },
}));

describe('loki result transformer', () => {
  beforeAll(() => {
    setTemplateSrv(new TemplateSrv());
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('lokiStreamsToRawDataFrame', () => {
    it('converts streams to series', () => {
      const data = ResultTransformer.lokiStreamsToRawDataFrame(streamResult);

      expect(data.fields[0].values.get(0)).toStrictEqual({ foo: 'bar' });
      expect(data.fields[1].values.get(0)).toEqual('2020-01-24T09:19:22.021Z');
      expect(data.fields[2].values.get(0)).toEqual(streamResult[0].values[0][1]);
      expect(data.fields[3].values.get(0)).toEqual(streamResult[0].values[0][0]);
      expect(data.fields[4].values.get(0)).toEqual('4b79cb43-81ce-52f7-b1e9-a207fff144dc');
      expect(data.fields[0].values.get(1)).toStrictEqual({ bar: 'foo' });
      expect(data.fields[1].values.get(1)).toEqual('2020-01-24T09:19:22.031Z');
      expect(data.fields[2].values.get(1)).toEqual(streamResult[1].values[0][1]);
      expect(data.fields[3].values.get(1)).toEqual(streamResult[1].values[0][0]);
      expect(data.fields[4].values.get(1)).toEqual('73d144f6-57f2-5a45-a49c-eb998e2006b1');
    });

    it('should always generate unique ids for logs', () => {
      const streamResultWithDuplicateLogs: LokiStreamResult[] = [
        {
          stream: {
            foo: 'bar',
          },

          values: [
            ['1579857562021616000', 't=2020-02-12T15:04:51+0000 lvl=info msg="Duplicated"'],
            ['1579857562021616000', 't=2020-02-12T15:04:51+0000 lvl=info msg="Duplicated"'],
            ['1579857562021616000', 't=2020-02-12T15:04:51+0000 lvl=info msg="Non-duplicated"'],
            ['1579857562021616000', 't=2020-02-12T15:04:51+0000 lvl=info msg="Duplicated"'],
          ],
        },
        {
          stream: {
            bar: 'foo',
          },
          values: [['1579857562021617000', 't=2020-02-12T15:04:51+0000 lvl=info msg="Non-dupliicated"']],
        },
      ];

      const data = ResultTransformer.lokiStreamsToRawDataFrame(streamResultWithDuplicateLogs);

      expect(data.fields[4].values.get(0)).toEqual('b48fe7dc-36aa-5d37-bfba-087ef810d8fa');
      expect(data.fields[4].values.get(1)).toEqual('b48fe7dc-36aa-5d37-bfba-087ef810d8fa_1');
      expect(data.fields[4].values.get(2)).not.toEqual('b48fe7dc-36aa-5d37-bfba-087ef810d8fa_2');
      expect(data.fields[4].values.get(3)).toEqual('b48fe7dc-36aa-5d37-bfba-087ef810d8fa_2');
      expect(data.fields[4].values.get(4)).not.toEqual('b48fe7dc-36aa-5d37-bfba-087ef810d8fa_3');
    });

    it('should append refId to the unique ids if refId is provided', () => {
      const data = ResultTransformer.lokiStreamsToRawDataFrame(streamResult, 'B');
      expect(data.fields[4].values.get(0)).toEqual('4b79cb43-81ce-52f7-b1e9-a207fff144dc_B');
      expect(data.fields[4].values.get(1)).toEqual('73d144f6-57f2-5a45-a49c-eb998e2006b1_B');
    });
  });

  describe('lokiStreamsToDataFrames', () => {
    it('should enhance data frames', () => {
      jest.spyOn(ResultTransformer, 'enhanceDataFrame');
      const dataFrames = ResultTransformer.lokiStreamsToDataFrames(lokiResponse, { refId: 'B', expr: '' }, 500, {
        derivedFields: [
          {
            matcherRegex: 'trace=(w+)',
            name: 'test',
            url: 'example.com',
          },
        ],
      });

      expect(ResultTransformer.enhanceDataFrame).toBeCalled();
      dataFrames.forEach((frame) => {
        expect(
          frame.fields.filter((field) => field.name === 'test' && field.type === 'string').length
        ).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('appendResponseToBufferedData', () => {
    it('should return a dataframe with ts in iso format', () => {
      const tailResponse: LokiTailResponse = {
        streams: [
          {
            stream: {
              filename: '/var/log/grafana/grafana.log',
              job: 'grafana',
            },
            values: [
              [
                '1581519914265798400',
                't=2020-02-12T15:04:51+0000 lvl=info msg="Starting Grafana" logger=server version=6.7.0-pre commit=6f09bc9fb4 branch=issue-21929 compiled=2020-02-11T20:43:28+0000',
              ],
            ],
          },
        ],
      };

      const data = new CircularDataFrame({ capacity: 1 });
      data.addField({ name: 'labels', type: FieldType.other });
      data.addField({ name: 'ts', type: FieldType.time, config: { displayName: 'Time' } });
      data.addField({ name: 'line', type: FieldType.string }).labels = { job: 'grafana' };
      data.addField({ name: 'id', type: FieldType.string });
      data.addField({ name: 'tsNs', type: FieldType.time, config: { displayName: 'Time ns' } });

      ResultTransformer.appendResponseToBufferedData(tailResponse, data);
      expect(data.get(0)).toEqual({
        ts: '2020-02-12T15:05:14.265Z',
        tsNs: '1581519914265798400',
        line: 't=2020-02-12T15:04:51+0000 lvl=info msg="Starting Grafana" logger=server version=6.7.0-pre commit=6f09bc9fb4 branch=issue-21929 compiled=2020-02-11T20:43:28+0000',
        labels: { filename: '/var/log/grafana/grafana.log' },
        id: '07f0607c-04ee-51bd-8a0c-fc0f85d37489',
      });
    });

    it('should always generate unique ids for logs', () => {
      const tailResponse: LokiTailResponse = {
        streams: [
          {
            stream: {
              filename: '/var/log/grafana/grafana.log',
              job: 'grafana',
            },
            values: [
              ['1581519914265798400', 't=2020-02-12T15:04:51+0000 lvl=info msg="Dupplicated 1"'],
              ['1581519914265798400', 't=2020-02-12T15:04:51+0000 lvl=info msg="Dupplicated 1"'],
              ['1581519914265798400', 't=2020-02-12T15:04:51+0000 lvl=info msg="Dupplicated 2"'],
              ['1581519914265798400', 't=2020-02-12T15:04:51+0000 lvl=info msg="Not dupplicated"'],
              ['1581519914265798400', 't=2020-02-12T15:04:51+0000 lvl=info msg="Dupplicated 1"'],
              ['1581519914265798400', 't=2020-02-12T15:04:51+0000 lvl=info msg="Dupplicated 2"'],
            ],
          },
        ],
      };

      const data = new CircularDataFrame({ capacity: 6 });
      data.addField({ name: 'labels', type: FieldType.other });
      data.addField({ name: 'ts', type: FieldType.time, config: { displayName: 'Time' } });
      data.addField({ name: 'line', type: FieldType.string }).labels = { job: 'grafana' };
      data.addField({ name: 'id', type: FieldType.string });
      data.addField({ name: 'tsNs', type: FieldType.time, config: { displayName: 'Time ns' } });
      data.refId = 'C';

      ResultTransformer.appendResponseToBufferedData(tailResponse, data);
      expect(data.get(0).id).toEqual('75e72b25-8589-5f99-8d10-ccb5eb27c1b4_C');
      expect(data.get(1).id).toEqual('75e72b25-8589-5f99-8d10-ccb5eb27c1b4_1_C');
      expect(data.get(2).id).toEqual('3ca99d6b-3ab5-5970-93c0-eb3c9449088e_C');
      expect(data.get(3).id).toEqual('ec9bea1d-70cb-556c-8519-d5d6ae18c004_C');
      expect(data.get(4).id).toEqual('75e72b25-8589-5f99-8d10-ccb5eb27c1b4_2_C');
      expect(data.get(5).id).toEqual('3ca99d6b-3ab5-5970-93c0-eb3c9449088e_1_C');
    });
  });

  describe('createMetricLabel', () => {
    it('should create correct label based on passed variables', () => {
      const label = ResultTransformer.createMetricLabel({}, {
        scopedVars: { testLabel: { selected: true, text: 'label1', value: 'label1' } },
        legendFormat: '{{$testLabel}}',
      } as unknown as TransformerOptions);
      expect(label).toBe('label1');
    });
  });

  describe('lokiResultsToTableModel', () => {
    it('should correctly set the type of the label column to be a string', () => {
      const lokiResultWithIntLabel = [
        { metric: { test: 1 }, value: [1610367143, 10] },
        { metric: { test: 2 }, value: [1610367144, 20] },
      ] as unknown as LokiMatrixResult[];

      const table = ResultTransformer.lokiResultsToTableModel(lokiResultWithIntLabel, 1, 'A', {});
      expect(table.columns[0].type).toBe('time');
      expect(table.columns[1].type).toBe('string');
      expect(table.columns[2].type).toBe('number');
    });
  });
});

describe('enhanceDataFrame', () => {
  it('adds links to fields', () => {
    const df = new MutableDataFrame({ fields: [{ name: 'Line', values: ['nothing', 'trace1=1234', 'trace2=foo'] }] });
    ResultTransformer.enhanceDataFrame(df, {
      derivedFields: [
        {
          matcherRegex: 'trace1=(\\w+)',
          name: 'trace1',
          url: 'http://localhost/${__value.raw}',
        },
        {
          matcherRegex: 'trace2=(\\w+)',
          name: 'trace2',
          url: 'test',
          datasourceUid: 'uid',
        },
        {
          matcherRegex: 'trace2=(\\w+)',
          name: 'trace2',
          url: 'test',
          datasourceUid: 'uid2',
          urlDisplayLabel: 'Custom Label',
        },
      ],
    });
    expect(df.fields.length).toBe(3);
    const fc = new FieldCache(df);
    expect(fc.getFieldByName('trace1')!.values.toArray()).toEqual([null, '1234', null]);
    expect(fc.getFieldByName('trace1')!.config.links![0]).toEqual({
      url: 'http://localhost/${__value.raw}',
      title: '',
    });

    expect(fc.getFieldByName('trace2')!.values.toArray()).toEqual([null, null, 'foo']);
    expect(fc.getFieldByName('trace2')!.config.links!.length).toBe(2);
    expect(fc.getFieldByName('trace2')!.config.links![0]).toEqual({
      title: '',
      internal: { datasourceName: 'Loki1', datasourceUid: 'uid', query: { query: 'test' } },
      url: '',
    });
    expect(fc.getFieldByName('trace2')!.config.links![1]).toEqual({
      title: 'Custom Label',
      internal: { datasourceName: 'Loki1', datasourceUid: 'uid2', query: { query: 'test' } },
      url: '',
    });
  });

  describe('lokiPointsToTimeseriesPoints()', () => {
    /**
     * NOTE on time parameters:
     * - Input time series data has timestamps in sec (like Prometheus)
     * - Output time series has timestamps in ms (as expected for the chart lib)
     */
    const data: Array<[number, string]> = [
      [1, '1'],
      [2, '0'],
      [4, '1'],
      [7, 'NaN'],
      [8, '+Inf'],
      [9, '-Inf'],
    ];

    it('returns data as is if step, start, and end align', () => {
      const result = ResultTransformer.lokiPointsToTimeseriesPoints(data);
      expect(result).toEqual([
        [1, 1000],
        [0, 2000],
        [1, 4000],
        [NaN, 7000],
        [Infinity, 8000],
        [-Infinity, 9000],
      ]);
    });
  });
});
