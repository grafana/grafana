import { Observable } from 'rxjs';

import {
  arrayToDataFrame,
  createDataFrame,
  DataFrame,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataTopic,
  dateTimeParse,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  LogLevel,
  LogRowModel,
  LogsDedupStrategy,
  LogsMetaKind,
  LogsVolumeCustomMetaData,
  LogsVolumeType,
  sortDataFrame,
  toDataFrame,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { getMockFrames } from 'app/plugins/datasource/loki/__mocks__/frames';
import { LokiQueryDirection } from 'app/plugins/datasource/loki/dataquery.gen';

import { MockObservableDataSourceApi } from '../../../test/mocks/datasource_srv';

import {
  COMMON_LABELS,
  dataFrameToLogsModel,
  dedupLogRows,
  filterLogLevels,
  getSeriesProperties,
  LIMIT_LABEL,
  logRowToSingleRowDataFrame,
  logSeriesToLogsModel,
  queryLogsSample,
  queryLogsVolume,
} from './logsModel';

const FROM = dateTimeParse('2021-06-17 00:00:00', { timeZone: 'utc' });
const TO = dateTimeParse('2021-06-17 00:00:00', { timeZone: 'utc' });

describe('dedupLogRows()', () => {
  test('should return rows as is when dedup is set to none', () => {
    const rows = [
      {
        entry: 'WARN test 1.23 on [xxx]',
      },
      {
        entry: 'WARN test 1.23 on [xxx]',
      },
    ] as LogRowModel[];
    expect(dedupLogRows(rows, LogsDedupStrategy.none)).toMatchObject(rows);
  });

  test('should dedup on exact matches', () => {
    const rows = [
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
    ] as LogRowModel[];
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
    const rows = [
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
    ] as LogRowModel[];
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
    const rows = [
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
    ] as LogRowModel[];
    expect(dedupLogRows(rows, LogsDedupStrategy.signature)).toEqual([
      {
        duplicates: 3,
        entry: 'WARN test 1.2323423 on [xxx]',
      },
    ]);
  });

  test('should return to non-deduped state on same log result', () => {
    const rows = [
      {
        entry: 'INFO 123',
      },
      {
        entry: 'WARN 123',
      },
      {
        entry: 'WARN 123',
      },
    ] as LogRowModel[];
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
    const rows = [
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
    ] as LogRowModel[];
    const filteredLogs = filterLogLevels(rows, new Set([LogLevel.debug]));
    expect(filteredLogs.length).toBe(2);
    expect(filteredLogs).toEqual([
      { entry: 'ERROR 1', logLevel: 'error' },
      { entry: 'TRACE 1', logLevel: 'trace' },
    ]);
  });
  test('should correctly filter out log levels and then deduplicate', () => {
    const rows = [
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
    ] as LogRowModel[];
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
    expect(dataFrameToLogsModel([], 0)).toMatchObject(emptyLogsModel);
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
      createDataFrame({
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
      createDataFrame({
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
      createDataFrame({
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
        refId: 'A',
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
        uid: 'A_foo',
      },
      {
        entry: 't=2019-04-26T16:42:50+0200 lvl=eror msg="new token…t unhashed token=56d9fdc5c8b7400bd51b060eea8ca9d7',
        labels: { filename: '/var/log/grafana/grafana.log', job: 'grafana' },
        logLevel: 'error',
        uniqueLabels: {},
        uid: 'A_bar',
      },
    ]);

    expect(logsModel.series).toHaveLength(2);
    expect(logsModel.series).toMatchObject([
      {
        name: 'info',
        fields: [
          { type: 'time', values: [1556270891000, 1556289770000] },
          { type: 'number', values: [1, 0] },
        ],
      },
      {
        name: 'error',
        fields: [
          { type: 'time', values: [1556289770000] },
          { type: 'number', values: [1] },
        ],
      },
    ]);
    expect(logsModel.meta).toHaveLength(2);
    expect(logsModel.meta![0]).toMatchObject({
      label: '',
      value: `2 lines returned`,
      kind: LogsMetaKind.String,
    });
    expect(logsModel.meta![1]).toMatchObject({
      label: COMMON_LABELS,
      value: {
        filename: '/var/log/grafana/grafana.log',
        job: 'grafana',
      },
      kind: LogsMetaKind.LabelsMap,
    });
  });

  it('given one series should return expected logs model with detected_level', () => {
    const series: DataFrame[] = [
      createDataFrame({
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: ['2019-04-26T09:28:11.352440161Z', '2019-04-26T14:42:50.991981292Z'],
          },
          {
            name: 'message',
            type: FieldType.string,
            values: ['foo=bar', 'foo=bar'],
            labels: {
              job: 'grafana',
            },
          },
          {
            name: 'detected_level',
            type: FieldType.string,
            values: ['info', 'error'],
          },
        ],
        meta: {
          limit: 1000,
        },
        refId: 'A',
      }),
    ];
    const logsModel = dataFrameToLogsModel(series, 1);
    expect(logsModel.hasUniqueLabels).toBeFalsy();
    expect(logsModel.rows).toHaveLength(2);
    expect(logsModel.rows).toMatchObject([
      {
        entry: 'foo=bar',
        labels: { job: 'grafana' },
        logLevel: 'info',
        uniqueLabels: {},
        uid: 'A_0',
      },
      {
        entry: 'foo=bar',
        labels: { job: 'grafana' },
        logLevel: 'error',
        uniqueLabels: {},
        uid: 'A_1',
      },
    ]);

    expect(logsModel.series).toHaveLength(2);
    expect(logsModel.series).toMatchObject([
      {
        name: 'info',
        fields: [
          { type: 'time', values: [1556270891000, 1556289770000] },
          { type: 'number', values: [1, 0] },
        ],
      },
      {
        name: 'error',
        fields: [
          { type: 'time', values: [1556289770000] },
          { type: 'number', values: [1] },
        ],
      },
    ]);
    expect(logsModel.meta).toHaveLength(2);
    expect(logsModel.meta![0]).toMatchObject({
      label: '',
      value: `2 lines returned`,
      kind: LogsMetaKind.String,
    });
    expect(logsModel.meta![1]).toMatchObject({
      label: COMMON_LABELS,
      value: {
        job: 'grafana',
      },
      kind: LogsMetaKind.LabelsMap,
    });
  });

  it('with infinite scrolling enabled it should return expected logs model', () => {
    config.featureToggles.logsInfiniteScrolling = true;

    const series: DataFrame[] = [
      createDataFrame({
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: ['2019-04-26T09:28:11.352440161Z'],
          },
          {
            name: 'message',
            type: FieldType.string,
            values: ['t=2019-04-26T11:05:28+0200 lvl=info msg="Initializing DatasourceCacheService" logger=server'],
            labels: {},
          },
          {
            name: 'id',
            type: FieldType.string,
            values: ['foo'],
          },
        ],
        meta: {
          limit: 1000,
        },
        refId: 'A',
      }),
    ];
    const logsModel = dataFrameToLogsModel(series, 1);
    expect(logsModel.meta![0]).toMatchObject({
      label: '',
      value: `1 line displayed`,
      kind: LogsMetaKind.String,
    });

    config.featureToggles.logsInfiniteScrolling = false;
  });

  it('given one series with limit as custom meta property should return correct limit', () => {
    const series: DataFrame[] = getTestDataFrame();
    const logsModel = dataFrameToLogsModel(series, 1);
    expect(logsModel.meta![0]).toMatchObject({
      label: '',
      value: `2 lines returned`,
      kind: LogsMetaKind.String,
    });
  });

  it('should return the expected meta when the line limit is reached', () => {
    const series: DataFrame[] = getTestDataFrame();
    series[0].meta = {
      custom: {
        limit: 2,
      },
    };
    const timeRange = {
      from: 1556270899999,
      to: 1556357299999,
    };
    const queries = [
      {
        expr: 'test',
        refId: 'A',
      },
    ];
    const logsModel = dataFrameToLogsModel(
      series,
      1,
      { from: timeRange.from.valueOf(), to: timeRange.to.valueOf() },
      queries
    );
    expect(logsModel.meta).toEqual([
      {
        label: '',
        value: '2 lines shown — 21.85% (5h 14min 40sec) of 24h',
        kind: 1,
      },
      {
        label: 'Common labels',
        value: { filename: '/var/log/grafana/grafana.log', job: 'grafana' },
        kind: 2,
      },
    ]);
  });

  it('should skip the time coverage when the query direction is Scan', () => {
    const series: DataFrame[] = getTestDataFrame();
    series[0].meta = {
      custom: {
        limit: 2,
      },
    };
    const timeRange = {
      from: 1556270800000,
      to: 1556270899999,
    };
    const queries = [
      {
        expr: 'test',
        refId: 'A',
        direction: LokiQueryDirection.Scan,
      },
    ];
    const logsModel = dataFrameToLogsModel(
      series,
      1,
      { from: timeRange.from.valueOf(), to: timeRange.to.valueOf() },
      queries
    );
    expect(logsModel.meta).toEqual([
      {
        label: '',
        value: '2 reached',
        kind: 1,
      },
      {
        label: 'Common labels',
        value: { filename: '/var/log/grafana/grafana.log', job: 'grafana' },
        kind: 2,
      },
    ]);
  });

  it('given one series with labels-field should return expected logs model', () => {
    const series: DataFrame[] = [
      createDataFrame({
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
        },
        refId: 'A',
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
        uid: 'A_foo',
      },
      {
        entry: 't=2019-04-26T16:42:50+0200 lvl=eror msg="new token…t unhashed token=56d9fdc5c8b7400bd51b060eea8ca9d7',
        labels: { filename: '/var/log/grafana/grafana.log', job: 'grafana' },
        logLevel: 'error',
        uniqueLabels: {},
        uid: 'A_bar',
      },
    ]);

    expect(logsModel.series).toHaveLength(2);
    expect(logsModel.series).toMatchObject([
      {
        name: 'info',
        fields: [
          { type: 'time', values: [1556270891000, 1556289770000] },
          { type: 'number', values: [1, 0] },
        ],
      },
      {
        name: 'error',
        fields: [
          { type: 'time', values: [1556289770000] },
          { type: 'number', values: [1] },
        ],
      },
    ]);
    expect(logsModel.meta).toHaveLength(2);
    expect(logsModel.meta![0]).toMatchObject({
      label: '',
      value: `2 lines returned`,
      kind: LogsMetaKind.String,
    });
    expect(logsModel.meta![1]).toMatchObject({
      label: COMMON_LABELS,
      value: { filename: '/var/log/grafana/grafana.log', job: 'grafana' },
      kind: LogsMetaKind.LabelsMap,
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
    const frame1 = createDataFrame({
      fields: [labels, time, line],
    });

    const frame2 = createDataFrame({
      fields: [time, labels, line],
    });

    const frame3 = createDataFrame({
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
      createDataFrame({
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
        refId: 'A',
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
        uid: 'A_foo',
      },
      {
        entry: 't=2019-04-26T16:42:50+0200 lvl=eror msg="new token…t unhashed token=56d9fdc5c8b7400bd51b060eea8ca9d7',
        labels: { filename: '/var/log/grafana/grafana.log', job: 'grafana', __error__: 'Failed while parsing' },
        logLevel: 'error',
        uniqueLabels: {},
        uid: 'A_bar',
      },
    ]);

    expect(logsModel.series).toHaveLength(2);
    expect(logsModel.meta).toHaveLength(3);
    expect(logsModel.meta![0]).toMatchObject({
      label: '',
      value: `2 lines returned`,
      kind: LogsMetaKind.String,
    });
    expect(logsModel.meta![1]).toMatchObject({
      label: '',
      value: 'Error when parsing some of the logs',
      kind: LogsMetaKind.Error,
    });
    expect(logsModel.meta![2]).toMatchObject({
      label: COMMON_LABELS,
      value: series[0].fields[1].labels,
      kind: LogsMetaKind.LabelsMap,
    });
  });

  it('given one series without labels should return expected logs model', () => {
    const series: DataFrame[] = [
      createDataFrame({
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

  it('given multiple series with duplicate results it should return unique uids', () => {
    const series: DataFrame[] = [
      toDataFrame({
        refId: 'A',
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
          },
          {
            name: 'id',
            type: FieldType.string,
            values: ['duplicate_uid'],
          },
        ],
      }),
      toDataFrame({
        refId: 'B',
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
          },
          {
            name: 'id',
            type: FieldType.string,
            values: ['duplicate_uid'],
          },
        ],
      }),
    ];
    const logsModel = dataFrameToLogsModel(series, 1);
    const uids = logsModel.rows.map((row) => row.uid);
    expect(uids).toEqual(['A_duplicate_uid', 'B_duplicate_uid']);
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
          { type: 'time', values: [0, 1000, 2000] },
          { type: 'number', values: [1, 0, 1] },
        ],
      },
      {
        name: 'debug',
        fields: [
          { type: 'time', values: [1000, 2000] },
          { type: 'number', values: [1, 0] },
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
      createDataFrame({
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
      label: '',
      value: `2 lines shown — 98.44% (5h 14min 40sec) of 5h 19min 40sec`,
      kind: LogsMetaKind.String,
    });
    expect(logsModel.meta![1]).toMatchObject({
      label: COMMON_LABELS,
      value: series[0].fields[1].labels,
      kind: LogsMetaKind.LabelsMap,
    });
  });

  it('should fallback to row index if no id', () => {
    const series: DataFrame[] = [
      toDataFrame({
        refId: 'A',
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
    expect(logsModel.rows[0].uid).toBe('A_0');
  });

  describe('infinite scrolling', () => {
    let frameA: DataFrame, frameB: DataFrame;
    beforeEach(() => {
      const { logFrameA, logFrameB } = getMockFrames();
      logFrameA.refId = `A`;
      logFrameA.fields[0].values = [1, 1];
      logFrameA.fields[1].values = ['line', 'line'];
      logFrameA.fields[3].values = ['3000000', '3000000'];
      logFrameA.fields[4].values = ['id', 'id'];
      logFrameB.refId = `B`;
      logFrameB.fields[0].values = [2, 2];
      logFrameB.fields[1].values = ['line 2', 'line 2'];
      logFrameB.fields[3].values = ['4000000', '4000000'];
      logFrameB.fields[4].values = ['id2', 'id2'];
      frameA = logFrameA;
      frameB = logFrameB;
    });

    it('deduplicates repeated log frames when called with deduplicate', () => {
      const logsModel = dataFrameToLogsModel(
        [frameA, frameB],
        1,
        { from: 1556270591353, to: 1556289770991 },
        [{ refId: `A` }, { refId: `B` }],
        true
      );

      expect(logsModel.rows).toHaveLength(2);
      expect(logsModel.rows[0].entry).toBe(frameA.fields[1].values[0]);
      expect(logsModel.rows[1].entry).toBe(frameB.fields[1].values[0]);
    });

    it('does not remove repeated log frames when invoked without deduplicate', () => {
      frameA.refId = 'A';
      frameB.refId = 'B';
      const logsModel = dataFrameToLogsModel([frameA, frameB], 1, { from: 1556270591353, to: 1556289770991 }, [
        { refId: 'A' },
        { refId: 'B' },
      ]);

      expect(logsModel.rows).toHaveLength(4);
      expect(logsModel.rows[0].entry).toBe(frameA.fields[1].values[0]);
      expect(logsModel.rows[1].entry).toBe(frameA.fields[1].values[1]);
      expect(logsModel.rows[2].entry).toBe(frameB.fields[1].values[0]);
      expect(logsModel.rows[3].entry).toBe(frameB.fields[1].values[1]);
    });
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
      { kind: 0, label: LIMIT_LABEL, value: 2000 },
      { kind: 1, label: 'Total bytes processed', value: '194  kB' },
      { kind: 2, label: COMMON_LABELS, value: { foo: 'bar', level: 'dbug' } },
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
    const rows = [
      { entry: 'foo', timeEpochMs: 10 },
      { entry: 'bar', timeEpochMs: 20 },
    ] as LogRowModel[];
    const range = { from: 10, to: 20 };
    const result = getSeriesProperties(rows, 1, range, 2, 1);
    expect(result.bucketSize).toBe(2);
    expect(result.visibleRange).toMatchObject(range);
  });

  it('clamps the range and adjusts the bucketSize if the logs row times do not completely cover the given range', () => {
    const rows = [
      { entry: 'foo', timeEpochMs: 10 },
      { entry: 'bar', timeEpochMs: 20 },
    ] as LogRowModel[];
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

  function createFrame(labels: object, timestamps: number[], values: number[], refId: string) {
    return toDataFrame({
      refId,
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

  function setup(datasourceSetup: () => void) {
    datasourceSetup();
    request = {
      targets: [
        { refId: 'A', target: 'volume query 1' },
        { refId: 'B', target: 'volume query 2' },
      ],
      scopedVars: {},
      requestId: '',
      interval: '',
      intervalMs: 0,
      range: {
        from: FROM,
        to: TO,
        raw: {
          from: FROM,
          to: TO,
        },
      },
      timezone: '',
      app: '',
      startTime: 0,
    };
    volumeProvider = queryLogsVolume(datasource, request, {
      targets: request.targets,
    });
  }

  function setupMultipleResults() {
    // level=unknown
    const resultAFrame1 = createFrame({ app: 'app01' }, [100, 200, 300], [5, 5, 5], 'A');
    // level=error
    const resultAFrame2 = createFrame({ app: 'app01', level: 'error' }, [100, 200, 300], [0, 1, 0], 'B');
    // level=unknown
    const resultBFrame1 = createFrame({ app: 'app02' }, [100, 200, 300], [1, 2, 3], 'A');
    // level=error
    const resultBFrame2 = createFrame({ app: 'app02', level: 'error' }, [100, 200, 300], [1, 1, 1], 'B');

    datasource = new MockObservableDataSourceApi('loki', [
      {
        state: LoadingState.Loading,
        data: [resultAFrame1, resultAFrame2],
      },
      {
        state: LoadingState.Done,
        data: [resultBFrame1, resultBFrame2],
      },
    ]);
  }

  function setupMultipleResultsStreaming() {
    // level=unknown
    const resultAFrame1 = createFrame({ app: 'app01' }, [100, 200, 300], [5, 5, 5], 'A');
    // level=error
    const resultAFrame2 = createFrame({ app: 'app01', level: 'error' }, [100, 200, 300], [0, 1, 0], 'B');

    datasource = new MockObservableDataSourceApi('loki', [
      {
        state: LoadingState.Streaming,
        data: [resultAFrame1],
      },
      {
        state: LoadingState.Done,
        data: [resultAFrame1, resultAFrame2],
      },
    ]);
  }

  function setupLogsVolumeWithAnnotations() {
    const resultAFrame1 = createFrame({ app: 'app01' }, [100, 200, 300], [5, 5, 5], 'A');
    const loadingFrame = arrayToDataFrame([
      {
        time: 100,
        timeEnd: 200,
        isRegion: true,
        color: 'rgba(120, 120, 120, 0.1)',
      },
    ]);
    loadingFrame.name = 'annotation';
    loadingFrame.meta = {
      dataTopic: DataTopic.Annotations,
    };

    datasource = new MockObservableDataSourceApi('loki', [
      {
        state: LoadingState.Streaming,
        data: [resultAFrame1, loadingFrame],
      },
      {
        state: LoadingState.Done,
        data: [resultAFrame1],
      },
    ]);
  }

  function setupErrorResponse() {
    datasource = new MockObservableDataSourceApi('loki', [], undefined, 'Error message');
  }

  it('applies correct meta data', async () => {
    setup(setupMultipleResults);

    const logVolumeCustomMeta: LogsVolumeCustomMetaData = {
      sourceQuery: { refId: 'A', target: 'volume query 1' } as DataQuery,
      datasourceName: 'loki',
      logsVolumeType: LogsVolumeType.FullRange,
      absoluteRange: {
        from: FROM.valueOf(),
        to: TO.valueOf(),
      },
    };

    await expect(volumeProvider).toEmitValuesWith((received) => {
      expect(received).toContainEqual({ state: LoadingState.Loading, error: undefined, data: [] });
      expect(received).toContainEqual({
        state: LoadingState.Done,
        error: undefined,
        data: [
          expect.objectContaining({
            fields: expect.anything(),
            meta: {
              custom: logVolumeCustomMeta,
            },
          }),
          expect.anything(),
        ],
      });
    });
  });

  it('applies correct meta data when streaming', async () => {
    setup(setupMultipleResultsStreaming);

    const logVolumeCustomMeta: LogsVolumeCustomMetaData = {
      sourceQuery: { refId: 'A', target: 'volume query 1' } as DataQuery,
      datasourceName: 'loki',
      logsVolumeType: LogsVolumeType.FullRange,
      absoluteRange: {
        from: FROM.valueOf(),
        to: TO.valueOf(),
      },
    };

    await expect(volumeProvider).toEmitValuesWith((received) => {
      expect(received).toContainEqual({ state: LoadingState.Loading, error: undefined, data: [] });
      expect(received).toContainEqual({
        state: LoadingState.Done,
        error: undefined,
        data: [
          expect.objectContaining({
            fields: expect.anything(),
            meta: {
              custom: logVolumeCustomMeta,
            },
          }),
          expect.anything(),
        ],
      });
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

  it('handles annotations in responses', async () => {
    setup(setupLogsVolumeWithAnnotations);

    const logVolumeCustomMeta: LogsVolumeCustomMetaData = {
      sourceQuery: { refId: 'A', target: 'volume query 1' } as DataQuery,
      datasourceName: 'loki',
      logsVolumeType: LogsVolumeType.FullRange,
      absoluteRange: {
        from: FROM.valueOf(),
        to: TO.valueOf(),
      },
    };

    await expect(volumeProvider).toEmitValuesWith((received) => {
      expect(received).toContainEqual({ state: LoadingState.Loading, error: undefined, data: [] });
      expect(received).toContainEqual({
        state: LoadingState.Streaming,
        error: undefined,
        data: [
          expect.objectContaining({
            fields: expect.anything(),
            meta: {
              custom: logVolumeCustomMeta,
            },
          }),
          expect.objectContaining({
            fields: expect.anything(),
            meta: {
              dataTopic: DataTopic.Annotations,
            },
            name: 'annotation',
          }),
        ],
      });
      expect(received).toContainEqual({
        state: LoadingState.Done,
        error: undefined,
        data: [
          expect.objectContaining({
            fields: expect.anything(),
            meta: {
              custom: logVolumeCustomMeta,
            },
          }),
        ],
      });
    });
  });
});

describe('logs sample', () => {
  class TestDataQuery implements DataQuery {
    refId = 'A';
    target = '';
  }

  let logsSampleProvider: Observable<DataQueryResponse>,
    datasource: MockObservableDataSourceApi,
    request: DataQueryRequest<TestDataQuery>;

  function createFrame(labels: object[], timestamps: number[], values: string[]) {
    return toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: timestamps },
        {
          name: 'Line',
          type: FieldType.string,
          values,
        },
        { name: 'labels', type: FieldType.other, values: labels },
      ],
    });
  }

  function setup(datasourceSetup: () => void) {
    datasourceSetup();
    request = {
      targets: [{ target: 'logs sample query 1' }, { target: 'logs sample query 2' }],
      scopedVars: {},
    } as unknown as DataQueryRequest<TestDataQuery>;
    logsSampleProvider = queryLogsSample(datasource, request);
  }
  const resultAFrame1 = createFrame([{ app: 'app01' }], [100, 200, 300], ['line 1', 'line 2', 'line 3']);
  const resultAFrame2 = createFrame(
    [{ app: 'app01', level: 'error' }],
    [400, 500, 600],
    ['line 4', 'line 5', 'line 6']
  );

  const resultBFrame1 = createFrame([{ app: 'app02' }], [700, 800, 900], ['line A', 'line B', 'line C']);
  const resultBFrame2 = createFrame(
    [{ app: 'app02', level: 'error' }],
    [1000, 1100, 1200],
    ['line D', 'line E', 'line F']
  );

  function setupMultipleResults() {
    datasource = new MockObservableDataSourceApi('loki', [
      {
        data: [resultAFrame1, resultAFrame2],
      },
      {
        data: [resultBFrame1, resultBFrame2, resultAFrame1, resultAFrame2],
      },
    ]);
  }

  function setupErrorResponse() {
    datasource = new MockObservableDataSourceApi('loki', [], undefined, 'Error message');
  }

  it('returns data', async () => {
    setup(setupMultipleResults);
    await expect(logsSampleProvider).toEmitValuesWith((received) => {
      expect(received).toContainEqual({ state: LoadingState.Loading, error: undefined, data: [] });
      expect(received).toContainEqual(
        expect.objectContaining({
          data: expect.arrayContaining([
            sortDataFrame(resultAFrame1, 0),
            sortDataFrame(resultAFrame2, 0),
            sortDataFrame(resultBFrame1, 0),
            sortDataFrame(resultBFrame2, 0),
          ]),
        })
      );
    });
  });

  it('returns error', async () => {
    setup(setupErrorResponse);

    await expect(logsSampleProvider).toEmitValuesWith((received) => {
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

describe('logs volume', () => {
  class TestDataQuery implements DataQuery {
    refId = 'A';
    target = '';
  }

  let logsVolumeProvider: Observable<DataQueryResponse>,
    datasource: MockObservableDataSourceApi,
    request: DataQueryRequest<TestDataQuery>;

  function createFrame() {
    return toDataFrame({
      fields: [
        {
          name: 'Time',
          type: FieldType.time,
          config: {},
          values: [3000000, 4000000],
        },
        {
          name: 'Value',
          type: FieldType.number,
          config: {},
          values: [5, 4],
          labels: {
            level: 'debug',
          },
        },
      ],
    });
  }

  function setup(datasourceSetup: () => void) {
    datasourceSetup();
    request = {
      targets: [{ target: 'logs sample query 1' }, { target: 'logs sample query 2' }],
      range: getDefaultTimeRange(),
      scopedVars: {},
    } as unknown as DataQueryRequest<TestDataQuery>;
    logsVolumeProvider = queryLogsVolume(datasource, request, { targets: request.targets });
  }
  const dataFrame = createFrame();

  function setupResult() {
    datasource = new MockObservableDataSourceApi('loki', [
      {
        data: [dataFrame],
      },
    ]);
  }
  function setupError() {
    datasource = new MockObservableDataSourceApi('loki', [], undefined, 'Error message');
  }
  function setupErrorWithData() {
    datasource = new MockObservableDataSourceApi(
      'loki',
      [
        {
          data: [dataFrame],
        },
      ],
      undefined,
      'Error message'
    );
  }

  it('returns logs volume data', async () => {
    setup(setupResult);
    await expect(logsVolumeProvider).toEmitValuesWith((received) => {
      expect(received).toContainEqual({ state: LoadingState.Loading, error: undefined, data: [] });
      expect(received).toContainEqual(
        expect.objectContaining({
          data: expect.arrayContaining([dataFrame]),
        })
      );
    });
  });

  it('returns errors', async () => {
    setup(setupError);

    await expect(logsVolumeProvider).toEmitValuesWith((received) => {
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

  it('returns errors and data', async () => {
    setup(setupErrorWithData);

    await expect(logsVolumeProvider).toEmitValuesWith((received) => {
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

const mockLogRow = {
  dataFrame: toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [0, 1] },
      {
        name: 'Line',
        type: FieldType.string,
        values: ['line1', 'line2'],
      },
      { name: 'labels', type: FieldType.other, values: [{ app: 'app01' }, { app: 'app02' }] },
    ],
    refId: 'Z',
  }),
  rowIndex: 0,
} as unknown as LogRowModel;

describe('logRowToDataFrame', () => {
  it('should return a DataFrame with the values from the specified row', () => {
    const result = logRowToSingleRowDataFrame(mockLogRow);

    expect(result?.length).toBe(1);

    expect(result?.fields[0].values[0]).toEqual(0);
    expect(result?.fields[1].values[0]).toEqual('line1');
    expect(result?.fields[2].values[0]).toEqual({ app: 'app01' });
  });

  it('should return a DataFrame with the values from the specified different row', () => {
    const result = logRowToSingleRowDataFrame({ ...mockLogRow, rowIndex: 1 });

    expect(result?.length).toBe(1);

    expect(result?.fields[0].values[0]).toEqual(1);
    expect(result?.fields[1].values[0]).toEqual('line2');
    expect(result?.fields[2].values[0]).toEqual({ app: 'app02' });
  });

  it('should handle an empty DataFrame', () => {
    const emptyLogRow = { dataFrame: { fields: [] }, rowIndex: 0 } as unknown as LogRowModel;
    const result = logRowToSingleRowDataFrame(emptyLogRow);

    expect(result?.length).toBe(0);
  });

  it('should handle rowIndex exceeding array bounds', () => {
    const invalidRowIndex = 10;
    const result = logRowToSingleRowDataFrame({ ...mockLogRow, rowIndex: invalidRowIndex });

    expect(result).toBe(null);
  });

  it('should use refId from original DataFrame', () => {
    const result = logRowToSingleRowDataFrame(mockLogRow);
    expect(result?.refId).toBe(mockLogRow.dataFrame.refId);
  });
});

function getTestDataFrame() {
  return [
    createDataFrame({
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
        custom: {
          limit: 1000,
        },
      },
    }),
  ];
}
