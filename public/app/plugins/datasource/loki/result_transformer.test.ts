import { FieldType, MutableDataFrame } from '@grafana/data';
import { LokiLegacyStreamResult, LokiStreamResult } from './types';
import * as ResultTransformer from './result_transformer';

const legacyStreamResult: LokiLegacyStreamResult[] = [
  {
    labels: '{foo="bar"}',
    entries: [
      {
        line: "foo: [32m'bar'[39m",
        ts: '1970-01-01T00:00:00Z',
      },
    ],
  },
  {
    labels: '{bar="foo"}',
    entries: [
      {
        line: "bar: 'foo'",
        ts: '1970-01-01T00:00:00Z',
      },
    ],
  },
];

const streamResult: LokiStreamResult[] = [
  {
    stream: {
      foo: 'bar',
    },
    values: [['1970-01-01T00:00:00Z', "foo: [32m'bar'[39m"]],
  },
  {
    stream: {
      bar: 'foo',
    },
    values: [['1970-01-01T00:00:00Z', "bar: 'foo'"]],
  },
];

describe('loki result transformer', () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('legacyLogStreamToDataFrame', () => {
    it('converts streams to series', () => {
      const data = legacyStreamResult.map(stream => ResultTransformer.legacyLogStreamToDataFrame(stream));

      expect(data.length).toBe(2);
      expect(data[0].fields[1].labels['foo']).toEqual('bar');
      expect(data[0].fields[0].values.get(0)).toEqual(legacyStreamResult[0].entries[0].ts);
      expect(data[0].fields[1].values.get(0)).toEqual(legacyStreamResult[0].entries[0].line);
      expect(data[0].fields[2].values.get(0)).toEqual('1970-01-01T00:00:00Z_{foo="bar"}');
      expect(data[1].fields[0].values.get(0)).toEqual(legacyStreamResult[1].entries[0].ts);
      expect(data[1].fields[1].values.get(0)).toEqual(legacyStreamResult[1].entries[0].line);
      expect(data[1].fields[2].values.get(0)).toEqual('1970-01-01T00:00:00Z_{bar="foo"}');
    });
  });

  describe('lokiLegacyStreamsToDataframes', () => {
    it('should enhance data frames', () => {
      jest.spyOn(ResultTransformer, 'enhanceDataFrame');
      const dataFrames = ResultTransformer.lokiLegacyStreamsToDataframes(
        { streams: legacyStreamResult },
        { refId: 'A' },
        500,
        {
          derivedFields: [
            {
              matcherRegex: 'tracer=(w+)',
              name: 'test',
              url: 'example.com',
            },
          ],
        }
      );

      expect(ResultTransformer.enhanceDataFrame).toBeCalled();
      dataFrames.forEach(frame => {
        expect(
          frame.fields.filter(field => field.name === 'test' && field.type === 'string').length
        ).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('lokiStreamResultToDataFrame', () => {
    it('converts streams to series', () => {
      const data = streamResult.map(stream => ResultTransformer.lokiStreamResultToDataFrame(stream));

      expect(data.length).toBe(2);
      expect(data[0].fields[1].labels['foo']).toEqual('bar');
      expect(data[0].fields[0].values.get(0)).toEqual(legacyStreamResult[0].entries[0].ts);
      expect(data[0].fields[1].values.get(0)).toEqual(legacyStreamResult[0].entries[0].line);
      expect(data[0].fields[2].values.get(0)).toEqual('1970-01-01T00:00:00Z_{foo="bar"}');
      expect(data[1].fields[0].values.get(0)).toEqual(legacyStreamResult[1].entries[0].ts);
      expect(data[1].fields[1].values.get(0)).toEqual(legacyStreamResult[1].entries[0].line);
      expect(data[1].fields[2].values.get(0)).toEqual('1970-01-01T00:00:00Z_{bar="foo"}');
    });
  });

  describe('lokiStreamsToDataframes', () => {
    it('should enhance data frames', () => {
      jest.spyOn(ResultTransformer, 'enhanceDataFrame');
      const dataFrames = ResultTransformer.lokiStreamsToDataframes(streamResult, { refId: 'B' }, 500, {
        derivedFields: [
          {
            matcherRegex: 'trace=(w+)',
            name: 'test',
            url: 'example.com',
          },
        ],
      });

      expect(ResultTransformer.enhanceDataFrame).toBeCalled();
      dataFrames.forEach(frame => {
        expect(
          frame.fields.filter(field => field.name === 'test' && field.type === 'string').length
        ).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('appendResponseToBufferedData', () => {
    it('appends response', () => {
      const data = new MutableDataFrame();
      data.addField({ name: 'ts', type: FieldType.time, config: { title: 'Time' } });
      data.addField({ name: 'line', type: FieldType.string });
      data.addField({ name: 'labels', type: FieldType.other });
      data.addField({ name: 'id', type: FieldType.string });

      ResultTransformer.appendLegacyResponseToBufferedData({ streams: legacyStreamResult }, data);
      expect(data.get(0)).toEqual({
        ts: '1970-01-01T00:00:00Z',
        line: "foo: [32m'bar'[39m",
        labels: { foo: 'bar' },
        id: '1970-01-01T00:00:00Z_{foo="bar"}',
      });
    });
  });
});
