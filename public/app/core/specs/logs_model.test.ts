import { SeriesData, FieldType, LogsModel, LogsMetaKind, LogsDedupStrategy, LogLevel } from '@grafana/ui';
import {
  dedupLogRows,
  calculateFieldStats,
  calculateLogsLabelStats,
  getParser,
  LogsParsers,
  seriesDataToLogsModel,
} from '../logs_model';

describe('dedupLogRows()', () => {
  test('should return rows as is when dedup is set to none', () => {
    const logs = {
      rows: [
        {
          entry: 'WARN test 1.23 on [xxx]',
        },
        {
          entry: 'WARN test 1.23 on [xxx]',
        },
      ],
    };
    expect(dedupLogRows(logs as LogsModel, LogsDedupStrategy.none).rows).toMatchObject(logs.rows);
  });

  test('should dedup on exact matches', () => {
    const logs = {
      rows: [
        {
          entry: 'WARN test 1.23 on [xxx]',
        },
        {
          entry: 'WARN test 1.23 on [xxx]',
        },
        {
          entry: 'INFO test 2.44 on [xxx]',
        },
        {
          entry: 'WARN test 1.23 on [xxx]',
        },
      ],
    };
    expect(dedupLogRows(logs as LogsModel, LogsDedupStrategy.exact).rows).toEqual([
      {
        duplicates: 1,
        entry: 'WARN test 1.23 on [xxx]',
      },
      {
        duplicates: 0,
        entry: 'INFO test 2.44 on [xxx]',
      },
      {
        duplicates: 0,
        entry: 'WARN test 1.23 on [xxx]',
      },
    ]);
  });

  test('should dedup on number matches', () => {
    const logs = {
      rows: [
        {
          entry: 'WARN test 1.2323423 on [xxx]',
        },
        {
          entry: 'WARN test 1.23 on [xxx]',
        },
        {
          entry: 'INFO test 2.44 on [xxx]',
        },
        {
          entry: 'WARN test 1.23 on [xxx]',
        },
      ],
    };
    expect(dedupLogRows(logs as LogsModel, LogsDedupStrategy.numbers).rows).toEqual([
      {
        duplicates: 1,
        entry: 'WARN test 1.2323423 on [xxx]',
      },
      {
        duplicates: 0,
        entry: 'INFO test 2.44 on [xxx]',
      },
      {
        duplicates: 0,
        entry: 'WARN test 1.23 on [xxx]',
      },
    ]);
  });

  test('should dedup on signature matches', () => {
    const logs = {
      rows: [
        {
          entry: 'WARN test 1.2323423 on [xxx]',
        },
        {
          entry: 'WARN test 1.23 on [xxx]',
        },
        {
          entry: 'INFO test 2.44 on [xxx]',
        },
        {
          entry: 'WARN test 1.23 on [xxx]',
        },
      ],
    };
    expect(dedupLogRows(logs as LogsModel, LogsDedupStrategy.signature).rows).toEqual([
      {
        duplicates: 3,
        entry: 'WARN test 1.2323423 on [xxx]',
      },
    ]);
  });

  test('should return to non-deduped state on same log result', () => {
    const logs = {
      rows: [
        {
          entry: 'INFO 123',
        },
        {
          entry: 'WARN 123',
        },
        {
          entry: 'WARN 123',
        },
      ],
    };
    expect(dedupLogRows(logs as LogsModel, LogsDedupStrategy.exact).rows).toEqual([
      {
        duplicates: 0,
        entry: 'INFO 123',
      },
      {
        duplicates: 1,
        entry: 'WARN 123',
      },
    ]);

    expect(dedupLogRows(logs as LogsModel, LogsDedupStrategy.none).rows).toEqual(logs.rows);
  });
});

describe('calculateFieldStats()', () => {
  test('should return no stats for empty rows', () => {
    expect(calculateFieldStats([], /foo=(.*)/)).toEqual([]);
  });

  test('should return no stats if extractor does not match', () => {
    const rows = [
      {
        entry: 'foo=bar',
      },
    ];

    expect(calculateFieldStats(rows as any, /baz=(.*)/)).toEqual([]);
  });

  test('should return stats for found field', () => {
    const rows = [
      {
        entry: 'foo="42 + 1"',
      },
      {
        entry: 'foo=503 baz=foo',
      },
      {
        entry: 'foo="42 + 1"',
      },
      {
        entry: 't=2018-12-05T07:44:59+0000 foo=503',
      },
    ];

    expect(calculateFieldStats(rows as any, /foo=("[^"]*"|\S+)/)).toMatchObject([
      {
        value: '"42 + 1"',
        count: 2,
      },
      {
        value: '503',
        count: 2,
      },
    ]);
  });
});

describe('calculateLogsLabelStats()', () => {
  test('should return no stats for empty rows', () => {
    expect(calculateLogsLabelStats([], '')).toEqual([]);
  });

  test('should return no stats of label is not found', () => {
    const rows = [
      {
        entry: 'foo 1',
        labels: {
          foo: 'bar',
        },
      },
    ];

    expect(calculateLogsLabelStats(rows as any, 'baz')).toEqual([]);
  });

  test('should return stats for found labels', () => {
    const rows = [
      {
        entry: 'foo 1',
        labels: {
          foo: 'bar',
        },
      },
      {
        entry: 'foo 0',
        labels: {
          foo: 'xxx',
        },
      },
      {
        entry: 'foo 2',
        labels: {
          foo: 'bar',
        },
      },
    ];

    expect(calculateLogsLabelStats(rows as any, 'foo')).toMatchObject([
      {
        value: 'bar',
        count: 2,
      },
      {
        value: 'xxx',
        count: 1,
      },
    ]);
  });
});

describe('getParser()', () => {
  test('should return no parser on empty line', () => {
    expect(getParser('')).toBeUndefined();
  });

  test('should return no parser on unknown line pattern', () => {
    expect(getParser('To Be or not to be')).toBeUndefined();
  });

  test('should return logfmt parser on key value patterns', () => {
    expect(getParser('foo=bar baz="41 + 1')).toEqual(LogsParsers.logfmt);
  });

  test('should return JSON parser on JSON log lines', () => {
    // TODO implement other JSON value types than string
    expect(getParser('{"foo": "bar", "baz": "41 + 1"}')).toEqual(LogsParsers.JSON);
  });
});

describe('LogsParsers', () => {
  describe('logfmt', () => {
    const parser = LogsParsers.logfmt;

    test('should detect format', () => {
      expect(parser.test('foo')).toBeFalsy();
      expect(parser.test('foo=bar')).toBeTruthy();
    });

    test('should return parsed fields', () => {
      expect(parser.getFields('foo=bar baz="42 + 1"')).toEqual(['foo=bar', 'baz="42 + 1"']);
    });

    test('should return label for field', () => {
      expect(parser.getLabelFromField('foo=bar')).toBe('foo');
    });

    test('should return value for field', () => {
      expect(parser.getValueFromField('foo=bar')).toBe('bar');
    });

    test('should build a valid value matcher', () => {
      const matcher = parser.buildMatcher('foo');
      const match = 'foo=bar'.match(matcher);
      expect(match).toBeDefined();
      expect(match[1]).toBe('bar');
    });
  });

  describe('JSON', () => {
    const parser = LogsParsers.JSON;

    test('should detect format', () => {
      expect(parser.test('foo')).toBeFalsy();
      expect(parser.test('{"foo":"bar"}')).toBeTruthy();
    });

    test('should return parsed fields', () => {
      expect(parser.getFields('{ "foo" : "bar", "baz" : 42 }')).toEqual(['"foo" : "bar"', '"baz" : 42']);
    });

    test('should return parsed fields for nested quotes', () => {
      expect(parser.getFields(`{"foo":"bar: '[value=\\"42\\"]'"}`)).toEqual([`"foo":"bar: '[value=\\"42\\"]'"`]);
    });

    test('should return label for field', () => {
      expect(parser.getLabelFromField('"foo" : "bar"')).toBe('foo');
    });

    test('should return value for field', () => {
      expect(parser.getValueFromField('"foo" : "bar"')).toBe('"bar"');
      expect(parser.getValueFromField('"foo" : 42')).toBe('42');
      expect(parser.getValueFromField('"foo" : 42.1')).toBe('42.1');
    });

    test('should build a valid value matcher for strings', () => {
      const matcher = parser.buildMatcher('foo');
      const match = '{"foo":"bar"}'.match(matcher);
      expect(match).toBeDefined();
      expect(match[1]).toBe('bar');
    });

    test('should build a valid value matcher for integers', () => {
      const matcher = parser.buildMatcher('foo');
      const match = '{"foo":42.1}'.match(matcher);
      expect(match).toBeDefined();
      expect(match[1]).toBe('42.1');
    });
  });
});

const emptyLogsModel = {
  hasUniqueLabels: false,
  rows: [],
  meta: [],
  series: [],
};

describe('seriesDataToLogsModel', () => {
  it('given empty series should return empty logs model', () => {
    expect(seriesDataToLogsModel([] as SeriesData[], 0)).toMatchObject(emptyLogsModel);
  });

  it('given series without correct series name should return empty logs model', () => {
    const series: SeriesData[] = [
      {
        fields: [],
        rows: [],
      },
    ];
    expect(seriesDataToLogsModel(series, 0)).toMatchObject(emptyLogsModel);
  });

  it('given series without a time field should return empty logs model', () => {
    const series: SeriesData[] = [
      {
        fields: [
          {
            name: 'message',
            type: FieldType.string,
          },
        ],
        rows: [],
      },
    ];
    expect(seriesDataToLogsModel(series, 0)).toMatchObject(emptyLogsModel);
  });

  it('given series without a string field should return empty logs model', () => {
    const series: SeriesData[] = [
      {
        fields: [
          {
            name: 'time',
            type: FieldType.time,
          },
        ],
        rows: [],
      },
    ];
    expect(seriesDataToLogsModel(series, 0)).toMatchObject(emptyLogsModel);
  });

  it('given one series should return expected logs model', () => {
    const series: SeriesData[] = [
      {
        labels: {
          filename: '/var/log/grafana/grafana.log',
          job: 'grafana',
        },
        fields: [
          {
            name: 'time',
            type: FieldType.time,
          },
          {
            name: 'message',
            type: FieldType.string,
          },
        ],
        rows: [
          [
            '2019-04-26T09:28:11.352440161Z',
            't=2019-04-26T11:05:28+0200 lvl=info msg="Initializing DatasourceCacheService" logger=server',
          ],
          [
            '2019-04-26T14:42:50.991981292Z',
            't=2019-04-26T16:42:50+0200 lvl=eror msg="new token…t unhashed token=56d9fdc5c8b7400bd51b060eea8ca9d7',
          ],
        ],
        meta: {
          limit: 1000,
        },
      },
    ];
    const logsModel = seriesDataToLogsModel(series, 0);
    expect(logsModel.hasUniqueLabels).toBeFalsy();
    expect(logsModel.rows).toHaveLength(2);
    expect(logsModel.rows).toMatchObject([
      {
        timestamp: '2019-04-26T14:42:50.991981292Z',
        entry: 't=2019-04-26T16:42:50+0200 lvl=eror msg="new token…t unhashed token=56d9fdc5c8b7400bd51b060eea8ca9d7',
        labels: { filename: '/var/log/grafana/grafana.log', job: 'grafana' },
        logLevel: 'error',
        uniqueLabels: {},
      },
      {
        timestamp: '2019-04-26T09:28:11.352440161Z',
        entry: 't=2019-04-26T11:05:28+0200 lvl=info msg="Initializing DatasourceCacheService" logger=server',
        labels: { filename: '/var/log/grafana/grafana.log', job: 'grafana' },
        logLevel: 'info',
        uniqueLabels: {},
      },
    ]);

    expect(logsModel.series).toHaveLength(2);
    expect(logsModel.meta).toHaveLength(2);
    expect(logsModel.meta[0]).toMatchObject({
      label: 'Common labels',
      value: series[0].labels,
      kind: LogsMetaKind.LabelsMap,
    });
    expect(logsModel.meta[1]).toMatchObject({
      label: 'Limit',
      value: `1000 (2 returned)`,
      kind: LogsMetaKind.String,
    });
  });

  it('given one series without labels should return expected logs model', () => {
    const series: SeriesData[] = [
      {
        fields: [
          {
            name: 'time',
            type: FieldType.time,
          },
          {
            name: 'message',
            type: FieldType.string,
          },
          {
            name: 'level',
            type: FieldType.string,
          },
        ],
        rows: [['1970-01-01T00:00:01Z', 'WARN boooo', 'dbug']],
      },
    ];
    const logsModel = seriesDataToLogsModel(series, 0);
    expect(logsModel.rows).toHaveLength(1);
    expect(logsModel.rows).toMatchObject([
      {
        entry: 'WARN boooo',
        labels: undefined,
        logLevel: LogLevel.debug,
        uniqueLabels: {},
      },
    ]);
  });

  it('given multiple series should return expected logs model', () => {
    const series: SeriesData[] = [
      {
        labels: {
          foo: 'bar',
          baz: '1',
          level: 'dbug',
        },
        fields: [
          {
            name: 'ts',
            type: FieldType.time,
          },
          {
            name: 'line',
            type: FieldType.string,
          },
        ],
        rows: [['1970-01-01T00:00:01Z', 'WARN boooo']],
      },
      {
        name: 'logs',
        labels: {
          foo: 'bar',
          baz: '2',
          level: 'err',
        },
        fields: [
          {
            name: 'time',
            type: FieldType.time,
          },
          {
            name: 'message',
            type: FieldType.string,
          },
        ],
        rows: [['1970-01-01T00:00:00Z', 'INFO 1'], ['1970-01-01T00:00:02Z', 'INFO 2']],
      },
    ];
    const logsModel = seriesDataToLogsModel(series, 0);
    expect(logsModel.hasUniqueLabels).toBeTruthy();
    expect(logsModel.rows).toHaveLength(3);
    expect(logsModel.rows).toMatchObject([
      {
        entry: 'INFO 2',
        labels: { foo: 'bar', baz: '2' },
        logLevel: LogLevel.error,
        uniqueLabels: { baz: '2' },
      },
      {
        entry: 'WARN boooo',
        labels: { foo: 'bar', baz: '1' },
        logLevel: LogLevel.debug,
        uniqueLabels: { baz: '1' },
      },
      {
        entry: 'INFO 1',
        labels: { foo: 'bar', baz: '2' },
        logLevel: LogLevel.error,
        uniqueLabels: { baz: '2' },
      },
    ]);

    expect(logsModel.series).toHaveLength(2);
    expect(logsModel.meta).toHaveLength(1);
    expect(logsModel.meta[0]).toMatchObject({
      label: 'Common labels',
      value: {
        foo: 'bar',
      },
      kind: LogsMetaKind.LabelsMap,
    });
  });
});
