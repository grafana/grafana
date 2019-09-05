import {
  DataFrame,
  FieldType,
  LogsModel,
  LogsMetaKind,
  LogsDedupStrategy,
  LogLevel,
  MutableDataFrame,
  toDataFrame,
} from '@grafana/data';
import { dedupLogRows, dataFrameToLogsModel } from '../logs_model';

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

const emptyLogsModel: any = {
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
        labels: {
          filename: '/var/log/grafana/grafana.log',
          job: 'grafana',
        },
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
          },
        ],
        meta: {
          limit: 1000,
        },
      }),
    ];
    const logsModel = dataFrameToLogsModel(series, 0);
    expect(logsModel.hasUniqueLabels).toBeFalsy();
    expect(logsModel.rows).toHaveLength(2);
    expect(logsModel.rows).toMatchObject([
      {
        timestamp: '2019-04-26T09:28:11.352440161Z',
        entry: 't=2019-04-26T11:05:28+0200 lvl=info msg="Initializing DatasourceCacheService" logger=server',
        labels: { filename: '/var/log/grafana/grafana.log', job: 'grafana' },
        logLevel: 'info',
        uniqueLabels: {},
      },
      {
        timestamp: '2019-04-26T14:42:50.991981292Z',
        entry: 't=2019-04-26T16:42:50+0200 lvl=eror msg="new token…t unhashed token=56d9fdc5c8b7400bd51b060eea8ca9d7',
        labels: { filename: '/var/log/grafana/grafana.log', job: 'grafana' },
        logLevel: 'error',
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
    const logsModel = dataFrameToLogsModel(series, 0);
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
    const series: DataFrame[] = [
      toDataFrame({
        labels: {
          foo: 'bar',
          baz: '1',
          level: 'dbug',
        },
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
        ],
      }),
      toDataFrame({
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
            values: ['1970-01-01T00:00:00Z', '1970-01-01T00:00:02Z'],
          },
          {
            name: 'message',
            type: FieldType.string,
            values: ['INFO 1', 'INFO 2'],
          },
        ],
      }),
    ];
    const logsModel = dataFrameToLogsModel(series, 0);
    expect(logsModel.hasUniqueLabels).toBeTruthy();
    expect(logsModel.rows).toHaveLength(3);
    expect(logsModel.rows).toMatchObject([
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
      {
        entry: 'INFO 2',
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
