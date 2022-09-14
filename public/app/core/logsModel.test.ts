import { Observable } from 'rxjs';

import {
  ArrayVector,
  DataFrame,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  dateTimeParse,
  FieldType,
  LoadingState,
  LogLevel,
  LogRowModel,
  LogsDedupStrategy,
  LogsMetaKind,
  MutableDataFrame,
  toDataFrame,
} from '@grafana/data';

import { MockObservableDataSourceApi } from '../../test/mocks/datasource_srv';

import {
  COMMON_LABELS,
  dataFrameToLogsModel,
  dedupLogRows,
  filterLogLevels,
  getSeriesProperties,
  LIMIT_LABEL,
  logSeriesToLogsModel,
  queryLogsVolume,
} from './logsModel';

describe('dedupLogRows()', () => {
  test('should return rows as is when dedup is set to none', () => {
    const rows: LogRowModel[] = [
      {
        entry: 'WARN test 1.23 on [xxx]',
      },
      {
        entry: 'WARN test 1.23 on [xxx]',
      },
    ] as any;
    expect(dedupLogRows(rows, LogsDedupStrategy.none)).toMatchObject(rows);
  });

  test('should dedup on exact matches', () => {
    const rows: LogRowModel[] = [
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
    ] as any;
    expect(dedupLogRows(rows, LogsDedupStrategy.exact)).toEqual([
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
    const rows: LogRowModel[] = [
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
    ] as any;
    expect(dedupLogRows(rows, LogsDedupStrategy.numbers)).toEqual([
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
    const rows: LogRowModel[] = [
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
    ] as any;
    expect(dedupLogRows(rows, LogsDedupStrategy.signature)).toEqual([
      {
        duplicates: 3,
        entry: 'WARN test 1.2323423 on [xxx]',
      },
    ]);
  });

  test('should return to non-deduped state on same log result', () => {
    const rows: LogRowModel[] = [
      {
        entry: 'INFO 123',
      },
      {
        entry: 'WARN 123',
      },
      {
        entry: 'WARN 123',
      },
    ] as any;
    expect(dedupLogRows(rows, LogsDedupStrategy.exact)).toEqual([
      {
        duplicates: 0,
        entry: 'INFO 123',
      },
      {
        duplicates: 1,
        entry: 'WARN 123',
      },
    ]);

    expect(dedupLogRows(rows, LogsDedupStrategy.none)).toEqual(rows);
  });
});

describe('filterLogLevels()', () => {
  test('should correctly filter out log levels', () => {
    const rows: LogRowModel[] = [
      {
        entry: 'DEBUG 1',
        logLevel: LogLevel.debug,
      },
      {
        entry: 'ERROR 1',
        logLevel: LogLevel.error,
      },
      {
        entry: 'TRACE 1',
        logLevel: LogLevel.trace,
      },
    ] as any;
    const filteredLogs = filterLogLevels(rows, new Set([LogLevel.debug]));
    expect(filteredLogs.length).toBe(2);
    expect(filteredLogs).toEqual([
      { entry: 'ERROR 1', logLevel: 'error' },
      { entry: 'TRACE 1', logLevel: 'trace' },
    ]);
  });
  test('should correctly filter out log levels and then deduplicate', () => {
    const rows: LogRowModel[] = [
      {
        entry: 'DEBUG 1',
        logLevel: LogLevel.debug,
      },
      {
        entry: 'DEBUG 2',
        logLevel: LogLevel.debug,
      },
      {
        entry: 'DEBUG 2',
        logLevel: LogLevel.debug,
      },
      {
        entry: 'ERROR 1',
        logLevel: LogLevel.error,
      },
      {
        entry: 'TRACE 1',
        logLevel: LogLevel.trace,
      },
    ] as any;
    const filteredLogs = filterLogLevels(rows, new Set([LogLevel.error]));
    const deduplicatedLogs = dedupLogRows(filteredLogs, LogsDedupStrategy.exact);
    expect(deduplicatedLogs.length).toBe(3);
    expect(deduplicatedLogs).toEqual([
      { duplicates: 0, entry: 'DEBUG 1', logLevel: 'debug' },
      { duplicates: 1, entry: 'DEBUG 2', logLevel: 'debug' },
      { duplicates: 0, entry: 'TRACE 1', logLevel: 'trace' },
    ]);
  });
});

const emptyLogsModel = {
  hasUniqueLabels: false,
  rows: [],
  meta: [],
  series: [],
};

describe('dataFrameToLogsModel', () => {
  it('given empty series should return empty logs model', () => {
    expect(dataFrameToLogsModel([] as DataFrame[], 0)).toMatchObject(emptyLogsModel);
  });

  it('given series without correct series name should return empty logs model', () => {
    const series: DataFrame[] = [
      toDataFrame({
        fields: [],
      }),
    ];
    expect(dataFrameToLogsModel(series, 0)).toMatchObject(emptyLogsModel);
  });

  it('given series without a time field should return empty logs model', () => {
    const series: DataFrame[] = [
      new MutableDataFrame({
        fields: [
          {
            name: 'message',
            type: FieldType.string,
            values: [],
          },
        ],
      }),
    ];
    expect(dataFrameToLogsModel(series, 0)).toMatchObject(emptyLogsModel);
  });

  it('given series without a string field should return empty logs model', () => {
    const series: DataFrame[] = [
      new MutableDataFrame({
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [],
          },
        ],
      }),
    ];
    expect(dataFrameToLogsModel(series, 0)).toMatchObject(emptyLogsModel);
  });

  it('given one series should return expected logs model', () => {
    const series: DataFrame[] = [
      new MutableDataFrame({
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: ['2019-04-26T09:28:11.352440161Z', '2019-04-26T14:42:50.991981292Z'],
          },
          {
            name: 'message',
            type: FieldType.string,
            values: [
              't=2019-04-26T11:05:28+0200 lvl=info msg="Initializing DatasourceCacheService" logger=server',
              't=2019-04-26T16:42:50+0200 lvl=eror msg="new token…t unhashed token=56d9fdc5c8b7400bd51b060eea8ca9d7',
            ],
            labels: {
              filename: '/var/log/grafana/grafana.log',
              job: 'grafana',
            },
          },
          {
            name: 'id',
            type: FieldType.string,
            values: ['foo', 'bar'],
          },
        ],
        meta: {
          limit: 1000,
        },
      }),
    ];
    const logsModel = dataFrameToLogsModel(series, 1);
    expect(logsModel.hasUniqueLabels).toBeFalsy();
    expect(logsModel.rows).toHaveLength(2);
    expect(logsModel.rows).toMatchObject([
      {
        entry: 't=2019-04-26T11:05:28+0200 lvl=info msg="Initializing DatasourceCacheService" logger=server',
        labels: { filename: '/var/log/grafana/grafana.log', job: 'grafana' },
        logLevel: 'info',
        uniqueLabels: {},
        uid: 'foo',
      },
      {
        entry: 't=2019-04-26T16:42:50+0200 lvl=eror msg="new token…t unhashed token=56d9fdc5c8b7400bd51b060eea8ca9d7',
        labels: { filename: '/var/log/grafana/grafana.log', job: 'grafana' },
        logLevel: 'error',
        uniqueLabels: {},
        uid: 'bar',
      },
    ]);

    expect(logsModel.series).toHaveLength(2);
    expect(logsModel.series).toMatchObject([
      {
        name: 'info',
        fields: [
          { type: 'time', values: new ArrayVector([1556270891000, 1556289770000]) },
          { type: 'number', values: new ArrayVector([1, 0]) },
        ],
      },
      {
        name: 'error',
        fields: [
          { type: 'time', values: new ArrayVector([1556289770000]) },
          { type: 'number', values: new ArrayVector([1]) },
        ],
      },
    ]);
    expect(logsModel.meta).toHaveLength(2);
    expect(logsModel.meta![0]).toMatchObject({
      label: COMMON_LABELS,
      value: {
        filename: '/var/log/grafana/grafana.log',
        job: 'grafana',
      },
      kind: LogsMetaKind.LabelsMap,
    });
    expect(logsModel.meta![1]).toMatchObject({
      label: LIMIT_LABEL,
      value: `1000 (2 returned)`,
      kind: LogsMetaKind.String,
    });
  });

  it('given one series with labels-field should return expected logs model', () => {
    const series: DataFrame[] = [
      new MutableDataFrame({
        fields: [
          {
            name: 'labels',
            type: FieldType.other,
            values: [
              {
                filename: '/var/log/grafana/grafana.log',
                job: 'grafana',
              },
              {
                filename: '/var/log/grafana/grafana.log',
                job: 'grafana',
              },
            ],
          },
          {
            name: 'time',
            type: FieldType.time,
            values: ['2019-04-26T09:28:11.352440161Z', '2019-04-26T14:42:50.991981292Z'],
          },
          {
            name: 'message',
            type: FieldType.string,
            values: [
              't=2019-04-26T11:05:28+0200 lvl=info msg="Initializing DatasourceCacheService" logger=server',
              't=2019-04-26T16:42:50+0200 lvl=eror msg="new token…t unhashed token=56d9fdc5c8b7400bd51b060eea8ca9d7',
            ],
          },
          {
            name: 'id',
            type: FieldType.string,
            values: ['foo', 'bar'],
          },
        ],
        meta: {
          limit: 1000,
          custom: {
            frameType: 'LabeledTimeValues',
          },
        },
      }),
    ];
    const logsModel = dataFrameToLogsModel(series, 1);
    expect(logsModel.hasUniqueLabels).toBeFalsy();
    expect(logsModel.rows).toHaveLength(2);
    expect(logsModel.rows).toMatchObject([
      {
        entry: 't=2019-04-26T11:05:28+0200 lvl=info msg="Initializing DatasourceCacheService" logger=server',
        labels: { filename: '/var/log/grafana/grafana.log', job: 'grafana' },
        logLevel: 'info',
        uniqueLabels: {},
        uid: 'foo',
      },
      {
        entry: 't=2019-04-26T16:42:50+0200 lvl=eror msg="new token…t unhashed token=56d9fdc5c8b7400bd51b060eea8ca9d7',
        labels: { filename: '/var/log/grafana/grafana.log', job: 'grafana' },
        logLevel: 'error',
        uniqueLabels: {},
        uid: 'bar',
      },
    ]);

    expect(logsModel.series).toHaveLength(2);
    expect(logsModel.series).toMatchObject([
      {
        name: 'info',
        fields: [
          { type: 'time', values: new ArrayVector([1556270891000, 1556289770000]) },
          { type: 'number', values: new ArrayVector([1, 0]) },
        ],
      },
      {
        name: 'error',
        fields: [
          { type: 'time', values: new ArrayVector([1556289770000]) },
          { type: 'number', values: new ArrayVector([1]) },
        ],
      },
    ]);
    expect(logsModel.meta).toHaveLength(2);
    expect(logsModel.meta![0]).toMatchObject({
      label: COMMON_LABELS,
      value: { filename: '/var/log/grafana/grafana.log', job: 'grafana' },
      kind: LogsMetaKind.LabelsMap,
    });
    expect(logsModel.meta![1]).toMatchObject({
      label: LIMIT_LABEL,
      value: `1000 (2 returned)`,
      kind: LogsMetaKind.String,
    });
  });

  it('given one series with labels-field it should work regardless the label-fields position', () => {
    const labels = {
      name: 'labels',
      type: FieldType.other,
      values: [
        {
          node: 'first',
          mode: 'slow',
        },
      ],
    };

    const time = {
      name: 'time',
      type: FieldType.time,
      values: ['2019-04-26T09:28:11.352440161Z'],
    };

    const line = {
      name: 'line',
      type: FieldType.string,
      values: ['line1'],
    };

    const meta = {
      custom: {
        frameType: 'LabeledTimeValues',
      },
    };

    const frame1 = new MutableDataFrame({
      meta,
      fields: [labels, time, line],
    });

    const frame2 = new MutableDataFrame({
      meta,
      fields: [time, labels, line],
    });

    const frame3 = new MutableDataFrame({
      meta,
      fields: [time, line, labels],
    });

    const logsModel1 = dataFrameToLogsModel([frame1], 1);
    expect(logsModel1.rows).toHaveLength(1);
    expect(logsModel1.rows[0].labels).toStrictEqual({ mode: 'slow', node: 'first' });

    const logsModel2 = dataFrameToLogsModel([frame2], 1);
    expect(logsModel2.rows).toHaveLength(1);
    expect(logsModel2.rows[0].labels).toStrictEqual({ mode: 'slow', node: 'first' });

    const logsModel3 = dataFrameToLogsModel([frame3], 1);
    expect(logsModel3.rows).toHaveLength(1);
    expect(logsModel3.rows[0].labels).toStrictEqual({ mode: 'slow', node: 'first' });
  });

  it('given one series with error should return expected logs model', () => {
    const series: DataFrame[] = [
      new MutableDataFrame({
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: ['2019-04-26T09:28:11.352440161Z', '2019-04-26T14:42:50.991981292Z'],
          },
          {
            name: 'message',
            type: FieldType.string,
            values: [
              't=2019-04-26T11:05:28+0200 lvl=info msg="Initializing DatasourceCacheService" logger=server',
              't=2019-04-26T16:42:50+0200 lvl=eror msg="new token…t unhashed token=56d9fdc5c8b7400bd51b060eea8ca9d7',
            ],
            labels: {
              filename: '/var/log/grafana/grafana.log',
              job: 'grafana',
              __error__: 'Failed while parsing',
            },
          },
          {
            name: 'id',
            type: FieldType.string,
            values: ['foo', 'bar'],
          },
        ],
        meta: {
          limit: 1000,
          custom: {
            error: 'Error when parsing some of the logs',
          },
        },
      }),
    ];
    const logsModel = dataFrameToLogsModel(series, 1);
    expect(logsModel.hasUniqueLabels).toBeFalsy();
    expect(logsModel.rows).toHaveLength(2);
    expect(logsModel.rows).toMatchObject([
      {
        entry: 't=2019-04-26T11:05:28+0200 lvl=info msg="Initializing DatasourceCacheService" logger=server',
        labels: { filename: '/var/log/grafana/grafana.log', job: 'grafana', __error__: 'Failed while parsing' },
        logLevel: 'info',
        uniqueLabels: {},
        uid: 'foo',
      },
      {
        entry: 't=2019-04-26T16:42:50+0200 lvl=eror msg="new token…t unhashed token=56d9fdc5c8b7400bd51b060eea8ca9d7',
        labels: { filename: '/var/log/grafana/grafana.log', job: 'grafana', __error__: 'Failed while parsing' },
        logLevel: 'error',
        uniqueLabels: {},
        uid: 'bar',
      },
    ]);

    expect(logsModel.series).toHaveLength(2);
    expect(logsModel.meta).toHaveLength(3);
    expect(logsModel.meta![0]).toMatchObject({
      label: COMMON_LABELS,
      value: series[0].fields[1].labels,
      kind: LogsMetaKind.LabelsMap,
    });
    expect(logsModel.meta![1]).toMatchObject({
      label: LIMIT_LABEL,
      value: `1000 (2 returned)`,
      kind: LogsMetaKind.String,
    });
    expect(logsModel.meta![2]).toMatchObject({
      label: '',
      value: 'Error when parsing some of the logs',
      kind: LogsMetaKind.Error,
    });
  });

  it('given one series without labels should return expected logs model', () => {
    const series: DataFrame[] = [
      new MutableDataFrame({
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: ['1970-01-01T00:00:01Z'],
          },
          {
            name: 'message',
            type: FieldType.string,
            values: ['WARN boooo'],
          },
          {
            name: 'level',
            type: FieldType.string,
            values: ['dbug'],
          },
        ],
      }),
    ];
    const logsModel = dataFrameToLogsModel(series, 1);
    expect(logsModel.rows).toHaveLength(1);
    expect(logsModel.rows).toMatchObject([
      {
        entry: 'WARN boooo',
        labels: {},
        logLevel: LogLevel.debug,
        uniqueLabels: {},
      },
    ]);
  });

  it('given multiple series with unique times should return expected logs model', () => {
    const series: DataFrame[] = [
      toDataFrame({
        fields: [
          {
            name: 'ts',
            type: FieldType.time,
            values: ['1970-01-01T00:00:01Z'],
          },
          {
            name: 'line',
            type: FieldType.string,
            values: ['WARN boooo'],
            labels: {
              foo: 'bar',
              baz: '1',
              level: 'dbug',
            },
          },
          {
            name: 'id',
            type: FieldType.string,
            values: ['0'],
          },
        ],
      }),
      toDataFrame({
        name: 'logs',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: ['1970-01-01T00:00:00Z', '1970-01-01T00:00:02Z'],
          },
          {
            name: 'message',
            type: FieldType.string,
            values: ['INFO 1', 'INFO 2'],
            labels: {
              foo: 'bar',
              baz: '2',
              level: 'err',
            },
          },
          {
            name: 'id',
            type: FieldType.string,
            values: ['1', '2'],
          },
        ],
      }),
    ];
    const logsModel = dataFrameToLogsModel(series, 1);
    expect(logsModel.hasUniqueLabels).toBeTruthy();
    expect(logsModel.rows).toHaveLength(3);
    expect(logsModel.rows).toMatchObject([
      {
        entry: 'INFO 1',
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
        entry: 'INFO 2',
        labels: { foo: 'bar', baz: '2' },
        logLevel: LogLevel.error,
        uniqueLabels: { baz: '2' },
      },
    ]);

    expect(logsModel.series).toHaveLength(2);
    expect(logsModel.series).toMatchObject([
      {
        name: 'error',
        fields: [
          { type: 'time', values: new ArrayVector([0, 1000, 2000]) },
          { type: 'number', values: new ArrayVector([1, 0, 1]) },
        ],
      },
      {
        name: 'debug',
        fields: [
          { type: 'time', values: new ArrayVector([1000, 2000]) },
          { type: 'number', values: new ArrayVector([1, 0]) },
        ],
      },
    ]);
    expect(logsModel.meta).toHaveLength(1);
    expect(logsModel.meta![0]).toMatchObject({
      label: COMMON_LABELS,
      value: {
        foo: 'bar',
      },
      kind: LogsMetaKind.LabelsMap,
    });
  });
  it('given multiple series with equal times should return expected logs model', () => {
    const series: DataFrame[] = [
      toDataFrame({
        fields: [
          {
            name: 'ts',
            type: FieldType.time,
            values: ['1970-01-01T00:00:00Z'],
          },
          {
            name: 'line',
            type: FieldType.string,
            values: ['WARN boooo 1'],
            labels: {
              foo: 'bar',
              baz: '1',
              level: 'dbug',
            },
          },
          {
            name: 'id',
            type: FieldType.string,
            values: ['0'],
          },
        ],
      }),
      toDataFrame({
        fields: [
          {
            name: 'ts',
            type: FieldType.time,
            values: ['1970-01-01T00:00:01Z'],
          },
          {
            name: 'line',
            type: FieldType.string,
            values: ['WARN boooo 2'],
            labels: {
              foo: 'bar',
              baz: '2',
              level: 'dbug',
            },
          },
          {
            name: 'id',
            type: FieldType.string,
            values: ['1'],
          },
        ],
      }),
      toDataFrame({
        name: 'logs',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: ['1970-01-01T00:00:00Z', '1970-01-01T00:00:01Z'],
          },
          {
            name: 'message',
            type: FieldType.string,
            values: ['INFO 1', 'INFO 2'],
            labels: {
              foo: 'bar',
              baz: '2',
              level: 'err',
            },
          },
          {
            name: 'id',
            type: FieldType.string,
            values: ['2', '3'],
          },
        ],
      }),
    ];
    const logsModel = dataFrameToLogsModel(series, 1);
    expect(logsModel.hasUniqueLabels).toBeTruthy();
    expect(logsModel.rows).toHaveLength(4);
    expect(logsModel.rows).toMatchObject([
      {
        entry: 'WARN boooo 1',
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
      {
        entry: 'WARN boooo 2',
        labels: { foo: 'bar', baz: '2' },
        logLevel: LogLevel.debug,
        uniqueLabels: { baz: '2' },
      },
      {
        entry: 'INFO 2',
        labels: { foo: 'bar', baz: '2' },
        logLevel: LogLevel.error,
        uniqueLabels: { baz: '2' },
      },
    ]);
  });

  it('should return expected line limit meta info when returned number of series equal the log limit', () => {
    const series: DataFrame[] = [
      new MutableDataFrame({
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: ['2019-04-26T09:28:11.352440161Z', '2019-04-26T14:42:50.991981292Z'],
          },
          {
            name: 'message',
            type: FieldType.string,
            values: [
              't=2019-04-26T11:05:28+0200 lvl=info msg="Initializing DatasourceCacheService" logger=server',
              't=2019-04-26T16:42:50+0200 lvl=eror msg="new token…t unhashed token=56d9fdc5c8b7400bd51b060eea8ca9d7',
            ],
            labels: {
              filename: '/var/log/grafana/grafana.log',
              job: 'grafana',
            },
          },
          {
            name: 'id',
            type: FieldType.string,
            values: ['foo', 'bar'],
          },
        ],
        meta: {
          limit: 2,
        },
      }),
    ];
    const logsModel = dataFrameToLogsModel(series, 1, { from: 1556270591353, to: 1556289770991 });
    expect(logsModel.meta).toHaveLength(2);
    expect(logsModel.meta![0]).toMatchObject({
      label: COMMON_LABELS,
      value: series[0].fields[1].labels,
      kind: LogsMetaKind.LabelsMap,
    });
    expect(logsModel.meta![1]).toMatchObject({
      label: LIMIT_LABEL,
      value: `2 reached, received logs cover 98.44% (5h 14min 40sec) of your selected time range (5h 19min 40sec)`,
      kind: LogsMetaKind.String,
    });
  });

  it('should fallback to row index if no id', () => {
    const series: DataFrame[] = [
      toDataFrame({
        labels: { foo: 'bar' },
        fields: [
          {
            name: 'ts',
            type: FieldType.time,
            values: ['1970-01-01T00:00:00Z'],
          },
          {
            name: 'line',
            type: FieldType.string,
            values: ['WARN boooo 1'],
          },
        ],
      }),
    ];
    const logsModel = dataFrameToLogsModel(series, 1);
    expect(logsModel.rows[0].uid).toBe('0');
  });
});

describe('logSeriesToLogsModel', () => {
  it('should return correct metaData even if the data is empty', () => {
    const logSeries: DataFrame[] = [
      {
        fields: [],
        length: 0,
        refId: 'A',

        meta: {
          searchWords: ['test'],
          limit: 1000,
          stats: [{ displayName: 'Summary: total bytes processed', value: 97048, unit: 'decbytes' }],
          custom: { lokiQueryStatKey: 'Summary: total bytes processed' },
          preferredVisualisationType: 'logs',
        },
      },
    ];

    const metaData = {
      hasUniqueLabels: false,
      meta: [
        { label: LIMIT_LABEL, value: 1000, kind: 0 },
        { label: 'Total bytes processed', value: '97.0  kB', kind: 1 },
      ],
      rows: [],
    };

    expect(logSeriesToLogsModel(logSeries)).toMatchObject(metaData);
  });
  it('should return correct metaData when some data frames have empty fields', () => {
    const logSeries: DataFrame[] = [
      toDataFrame({
        fields: [
          {
            name: 'ts',
            type: FieldType.time,
            values: ['1970-01-01T00:00:01Z', '1970-02-01T00:00:01Z', '1970-03-01T00:00:01Z'],
          },
          {
            name: 'line',
            type: FieldType.string,
            values: ['WARN boooo 0', 'WARN boooo 1', 'WARN boooo 2'],
            labels: {
              foo: 'bar',
              level: 'dbug',
            },
          },
          {
            name: 'id',
            type: FieldType.string,
            values: ['0', '1', '2'],
          },
        ],
        refId: 'A',
        meta: {
          searchWords: ['test'],
          limit: 1000,
          stats: [{ displayName: 'Summary: total bytes processed', value: 97048, unit: 'decbytes' }],
          custom: { lokiQueryStatKey: 'Summary: total bytes processed' },
          preferredVisualisationType: 'logs',
        },
      }),
      toDataFrame({
        fields: [],
        length: 0,
        refId: 'B',
        meta: {
          searchWords: ['test'],
          limit: 1000,
          stats: [{ displayName: 'Summary: total bytes processed', value: 97048, unit: 'decbytes' }],
          custom: { lokiQueryStatKey: 'Summary: total bytes processed' },
          preferredVisualisationType: 'logs',
        },
      }),
    ];

    const logsModel = dataFrameToLogsModel(logSeries, 0);
    expect(logsModel.meta).toMatchObject([
      { kind: 2, label: COMMON_LABELS, value: { foo: 'bar', level: 'dbug' } },
      { kind: 0, label: LIMIT_LABEL, value: 2000 },
      { kind: 1, label: 'Total bytes processed', value: '194  kB' },
    ]);
    expect(logsModel.rows).toHaveLength(3);
    expect(logsModel.rows).toMatchObject([
      {
        entry: 'WARN boooo 0',
        labels: { foo: 'bar' },
        logLevel: LogLevel.debug,
      },
      {
        entry: 'WARN boooo 1',
        labels: { foo: 'bar' },
        logLevel: LogLevel.debug,
      },
      {
        entry: 'WARN boooo 2',
        labels: { foo: 'bar' },
        logLevel: LogLevel.debug,
      },
    ]);
  });

  it('should return empty string if message field is undefined', () => {
    const logSeries: DataFrame[] = [
      toDataFrame({
        fields: [
          {
            name: 'ts',
            type: FieldType.time,
            values: ['1970-01-01T00:00:01Z', '1970-02-01T00:00:01Z', '1970-03-01T00:00:01Z'],
          },
          {
            name: 'line',
            type: FieldType.string,
            values: ['WARN boooo 0', undefined, 'WARN boooo 2'],
            labels: {
              foo: 'bar',
              level: 'dbug',
            },
          },
          {
            name: 'id',
            type: FieldType.string,
            values: ['0', '1', '2'],
          },
        ],
        refId: 'A',
        meta: {},
      }),
    ];

    const logsModel = dataFrameToLogsModel(logSeries, 0);
    expect(logsModel.rows).toHaveLength(3);
    expect(logsModel.rows).toMatchObject([
      {
        entry: 'WARN boooo 0',
        labels: { foo: 'bar' },
        logLevel: LogLevel.debug,
      },
      {
        entry: '',
        labels: { foo: 'bar' },
        logLevel: LogLevel.debug,
      },
      {
        entry: 'WARN boooo 2',
        labels: { foo: 'bar' },
        logLevel: LogLevel.debug,
      },
    ]);
  });

  it('should correctly get the log level if the message has ANSI color', () => {
    const logSeries: DataFrame[] = [
      toDataFrame({
        fields: [
          {
            name: 'ts',
            type: FieldType.time,
            values: ['1970-01-01T00:00:01Z'],
          },
          {
            name: 'line',
            type: FieldType.string,
            values: ['Line with ANSI \u001B[31mwarn\u001B[0m et dolor'],
          },
          {
            name: 'id',
            type: FieldType.string,
            values: ['0'],
          },
        ],
        refId: 'A',
        meta: {},
      }),
    ];

    const logsModel = dataFrameToLogsModel(logSeries, 0);
    expect(logsModel.rows).toHaveLength(1);
    expect(logsModel.rows[0].logLevel).toEqual(LogLevel.warn);
  });
});

describe('getSeriesProperties()', () => {
  it('sets a minimum bucket size', () => {
    const result = getSeriesProperties([], 2, undefined, 3, 123);
    expect(result.bucketSize).toBe(123);
  });

  it('does not adjust the bucketSize if there is no range', () => {
    const result = getSeriesProperties([], 30, undefined, 70);
    expect(result.bucketSize).toBe(2100);
  });

  it('does not adjust the bucketSize if the logs row times match the given range', () => {
    const rows: LogRowModel[] = [
      { entry: 'foo', timeEpochMs: 10 },
      { entry: 'bar', timeEpochMs: 20 },
    ] as any;
    const range = { from: 10, to: 20 };
    const result = getSeriesProperties(rows, 1, range, 2, 1);
    expect(result.bucketSize).toBe(2);
    expect(result.visibleRange).toMatchObject(range);
  });

  it('clamps the range and adjusts the bucketSize if the logs row times do not completely cover the given range', () => {
    const rows: LogRowModel[] = [
      { entry: 'foo', timeEpochMs: 10 },
      { entry: 'bar', timeEpochMs: 20 },
    ] as any;
    const range = { from: 0, to: 30 };
    const result = getSeriesProperties(rows, 3, range, 2, 1);
    // Bucketsize 6 gets shortened to 4 because of new visible range is 20ms vs original range being 30ms
    expect(result.bucketSize).toBe(4);
    // From time is also aligned to bucketSize (divisible by 4)
    expect(result.visibleRange).toMatchObject({ from: 8, to: 30 });
  });
});

describe('logs volume', () => {
  class TestDataQuery implements DataQuery {
    refId = 'a';
    target = '';
  }

  let volumeProvider: Observable<DataQueryResponse>,
    datasource: MockObservableDataSourceApi,
    request: DataQueryRequest<TestDataQuery>;

  function createFrame(labels: object, timestamps: number[], values: number[]) {
    return toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: timestamps },
        {
          name: 'Number',
          type: FieldType.number,
          values,
          labels,
        },
      ],
    });
  }

  function createExpectedFields(levelName: string, timestamps: number[], values: number[]) {
    return [
      { name: 'Time', values: { buffer: timestamps } },
      {
        name: 'Value',
        config: { displayNameFromDS: levelName },
        values: { buffer: values },
      },
    ];
  }

  function setup(datasourceSetup: () => void) {
    datasourceSetup();
    request = {
      targets: [{ target: 'volume query 1' }, { target: 'volume query 2' }],
      scopedVars: {},
    } as unknown as DataQueryRequest<TestDataQuery>;
    volumeProvider = queryLogsVolume(datasource, request, {
      extractLevel: (dataFrame: DataFrame) => {
        return dataFrame.fields[1]!.labels!.level === 'error' ? LogLevel.error : LogLevel.unknown;
      },
      range: {
        from: dateTimeParse('2021-06-17 00:00:00', { timeZone: 'utc' }),
        to: dateTimeParse('2021-06-17 00:00:00', { timeZone: 'utc' }),
        raw: { from: '0', to: '1' },
      },
      targets: request.targets,
    });
  }

  function setupMultipleResults() {
    // level=unknown
    const resultAFrame1 = createFrame({ app: 'app01' }, [100, 200, 300], [5, 5, 5]);
    // level=error
    const resultAFrame2 = createFrame({ app: 'app01', level: 'error' }, [100, 200, 300], [0, 1, 0]);
    // level=unknown
    const resultBFrame1 = createFrame({ app: 'app02' }, [100, 200, 300], [1, 2, 3]);
    // level=error
    const resultBFrame2 = createFrame({ app: 'app02', level: 'error' }, [100, 200, 300], [1, 1, 1]);

    datasource = new MockObservableDataSourceApi('loki', [
      {
        data: [resultAFrame1, resultAFrame2],
      },
      {
        data: [resultBFrame1, resultBFrame2],
      },
    ]);
  }

  function setupErrorResponse() {
    datasource = new MockObservableDataSourceApi('loki', [], undefined, 'Error message');
  }

  it('aggregates data frames by level', async () => {
    setup(setupMultipleResults);

    await expect(volumeProvider).toEmitValuesWith((received) => {
      expect(received).toMatchObject([
        { state: LoadingState.Loading, error: undefined, data: [] },
        {
          state: LoadingState.Done,
          error: undefined,
          data: [
            {
              fields: createExpectedFields('unknown', [100, 200, 300], [6, 7, 8]),
            },
            {
              fields: createExpectedFields('error', [100, 200, 300], [1, 2, 1]),
            },
          ],
        },
      ]);
    });
  });

  it('returns error', async () => {
    setup(setupErrorResponse);

    await expect(volumeProvider).toEmitValuesWith((received) => {
      expect(received).toMatchObject([
        { state: LoadingState.Loading, error: undefined, data: [] },
        {
          state: LoadingState.Error,
          error: 'Error message',
          data: [],
        },
        'Error message',
      ]);
    });
  });
});
