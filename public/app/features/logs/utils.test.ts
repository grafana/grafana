import {
  AbsoluteTimeRange,
  ArrayVector,
  FieldType,
  Labels,
  LogLevel,
  LogRowModel,
  LogsModel,
  LogsSortOrder,
  MutableDataFrame,
  DataFrame,
} from '@grafana/data';

import {
  calculateLogsLabelStats,
  calculateStats,
  checkLogsError,
  getLogLevel,
  getLogLevelFromKey,
  getLogsVolumeMaximumRange,
  logRowsToReadableJson,
  mergeLogsVolumeDataFrames,
  sortLogsResult,
} from './utils';

describe('getLoglevel()', () => {
  it('returns no log level on empty line', () => {
    expect(getLogLevel('')).toBe(LogLevel.unknown);
  });

  it('returns no log level on when level is part of a word', () => {
    expect(getLogLevel('who warns us')).toBe(LogLevel.unknown);
  });

  it('returns same log level for long and short version', () => {
    expect(getLogLevel('[Warn]')).toBe(LogLevel.warning);
    expect(getLogLevel('[Warning]')).toBe(LogLevel.warning);
    expect(getLogLevel('[Warn]')).toBe('warning');
  });

  it('returns correct log level when level is capitalized', () => {
    expect(getLogLevel('WARN')).toBe(LogLevel.warn);
  });

  it('returns log level on line contains a log level', () => {
    expect(getLogLevel('warn: it is looking bad')).toBe(LogLevel.warn);
    expect(getLogLevel('2007-12-12 12:12:12 [WARN]: it is looking bad')).toBe(LogLevel.warn);
  });

  it('returns first log level found', () => {
    expect(getLogLevel('WARN this could be a debug message')).toBe(LogLevel.warn);
    expect(getLogLevel('WARN this is a non-critical message')).toBe(LogLevel.warn);
  });
});

describe('getLogLevelFromKey()', () => {
  it('returns correct log level', () => {
    expect(getLogLevelFromKey('info')).toBe(LogLevel.info);
  });
  it('returns correct log level when level is capitalized', () => {
    expect(getLogLevelFromKey('INFO')).toBe(LogLevel.info);
  });
  it('returns unknown log level when level is integer', () => {
    expect(getLogLevelFromKey(1)).toBe(LogLevel.unknown);
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
        } as Labels,
      },
    ] as LogRowModel[];

    expect(calculateLogsLabelStats(rows, 'baz')).toEqual([]);
  });

  test('should return stats for found labels', () => {
    const rows = [
      {
        entry: 'foo 1',
        labels: {
          foo: 'bar',
        } as Labels,
      },
      {
        entry: 'foo 0',
        labels: {
          foo: 'xxx',
        } as Labels,
      },
      {
        entry: 'foo 2',
        labels: {
          foo: 'bar',
        } as Labels,
      },
    ] as LogRowModel[];

    expect(calculateLogsLabelStats(rows, 'foo')).toMatchObject([
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

describe('calculateStats()', () => {
  test('should return no stats for empty array', () => {
    expect(calculateStats([])).toEqual([]);
  });

  test('should return correct stats', () => {
    const values = ['one', 'one', null, undefined, 'two'];
    expect(calculateStats(values)).toMatchObject([
      {
        value: 'one',
        count: 2,
        proportion: 2 / 3,
      },
      {
        value: 'two',
        count: 1,
        proportion: 1 / 3,
      },
    ]);
  });
});

describe('sortLogsResult', () => {
  const firstRow: LogRowModel = {
    rowIndex: 0,
    entryFieldIndex: 0,
    dataFrame: new MutableDataFrame(),
    entry: '',
    hasAnsi: false,
    hasUnescapedContent: false,
    labels: {},
    logLevel: LogLevel.info,
    raw: '',
    timeEpochMs: 0,
    timeEpochNs: '0',
    timeFromNow: '',
    timeLocal: '',
    timeUtc: '',
    uid: '1',
  };
  const sameAsFirstRow = firstRow;
  const secondRow: LogRowModel = {
    rowIndex: 1,
    entryFieldIndex: 0,
    dataFrame: new MutableDataFrame(),
    entry: '',
    hasAnsi: false,
    hasUnescapedContent: false,
    labels: {},
    logLevel: LogLevel.info,
    raw: '',
    timeEpochMs: 10,
    timeEpochNs: '10000000',
    timeFromNow: '',
    timeLocal: '',
    timeUtc: '',
    uid: '2',
  };

  describe('when called with LogsSortOrder.Descending', () => {
    it('then it should sort descending', () => {
      const logsResult: LogsModel = {
        rows: [firstRow, sameAsFirstRow, secondRow],
        hasUniqueLabels: false,
      };
      const result = sortLogsResult(logsResult, LogsSortOrder.Descending);

      expect(result).toEqual({
        rows: [secondRow, firstRow, sameAsFirstRow],
        hasUniqueLabels: false,
      });
    });
  });

  describe('when called with LogsSortOrder.Ascending', () => {
    it('then it should sort ascending', () => {
      const logsResult: LogsModel = {
        rows: [secondRow, firstRow, sameAsFirstRow],
        hasUniqueLabels: false,
      };
      const result = sortLogsResult(logsResult, LogsSortOrder.Ascending);

      expect(result).toEqual({
        rows: [firstRow, sameAsFirstRow, secondRow],
        hasUniqueLabels: false,
      });
    });
  });
});

describe('checkLogsError()', () => {
  const log = {
    labels: {
      __error__: 'Error Message',
      foo: 'boo',
    } as Labels,
  } as LogRowModel;
  test('should return correct error if error is present', () => {
    expect(checkLogsError(log)).toStrictEqual({ hasError: true, errorMessage: 'Error Message' });
  });
});

describe('logRowsToReadableJson', () => {
  const testRow: LogRowModel = {
    rowIndex: 1,
    entryFieldIndex: 0,
    dataFrame: new MutableDataFrame(),
    entry: 'test entry',
    hasAnsi: false,
    hasUnescapedContent: false,
    labels: {
      foo: 'bar',
    },
    logLevel: LogLevel.info,
    raw: '',
    timeEpochMs: 10,
    timeEpochNs: '123456789',
    timeFromNow: '',
    timeLocal: '',
    timeUtc: '',
    uid: '2',
  };
  const testDf = new MutableDataFrame();
  testDf.addField({ name: 'foo2', values: ['bar2'] });
  const testRow2: LogRowModel = {
    rowIndex: 0,
    entryFieldIndex: -1,
    dataFrame: testDf,
    entry: 'test entry',
    hasAnsi: false,
    hasUnescapedContent: false,
    labels: {
      foo: 'bar',
    },
    logLevel: LogLevel.info,
    raw: '',
    timeEpochMs: 10,
    timeEpochNs: '123456789',
    timeFromNow: '',
    timeLocal: '',
    timeUtc: '',
    uid: '2',
  };

  it('should format a single row', () => {
    const result = logRowsToReadableJson([testRow]);

    expect(result).toEqual([{ line: 'test entry', timestamp: '123456789', fields: { foo: 'bar' } }]);
  });

  it('should format a df field row', () => {
    const result = logRowsToReadableJson([testRow2]);

    expect(result).toEqual([{ line: 'test entry', timestamp: '123456789', fields: { foo: 'bar', foo2: 'bar2' } }]);
  });
});

describe('mergeLogsVolumeDataFrames', () => {
  function mockLogVolume(level: string, timestamps: number[], values: number[]): DataFrame {
    const frame = new MutableDataFrame();
    frame.addField({ name: 'Time', type: FieldType.time, values: timestamps });
    frame.addField({ name: 'Value', type: FieldType.number, values, config: { displayNameFromDS: level } });
    return frame;
  }

  it('merges log volumes', () => {
    // timestamps: 1 2 3 4 5 6

    // info 1:     1 - 1 - - -
    // info 2:     2 3 - - - -
    // total:      3 3 1 - - -
    const infoVolume1 = mockLogVolume('info', [1, 3], [1, 1]);
    const infoVolume2 = mockLogVolume('info', [1, 2], [2, 3]);

    // debug 1:    - 2 3 - - -
    // debug 2:    1 - - - 0 -
    // total:      1 2 3 - 0 -
    const debugVolume1 = mockLogVolume('debug', [2, 3], [2, 3]);
    const debugVolume2 = mockLogVolume('debug', [1, 5], [1, 0]);

    // error 1:    1 - - - - 1
    // error 2:    1 - - - - -
    // total:      2 - - - - 1
    const errorVolume1 = mockLogVolume('error', [1, 6], [1, 1]);
    const errorVolume2 = mockLogVolume('error', [1], [1]);

    // all totals: 6 5 4 - 0 2

    const { dataFrames: merged, maximum } = mergeLogsVolumeDataFrames([
      infoVolume1,
      infoVolume2,
      debugVolume1,
      debugVolume2,
      errorVolume1,
      errorVolume2,
    ]);

    expect(merged).toHaveLength(3);
    expect(merged).toMatchObject([
      {
        fields: [
          {
            name: 'Time',
            type: FieldType.time,
            values: new ArrayVector([1, 2, 3]),
          },
          {
            name: 'Value',
            type: FieldType.number,
            values: new ArrayVector([3, 3, 1]),
            config: {
              displayNameFromDS: 'info',
            },
          },
        ],
      },
      {
        fields: [
          {
            name: 'Time',
            type: FieldType.time,
            values: new ArrayVector([1, 2, 3, 5]),
          },
          {
            name: 'Value',
            type: FieldType.number,
            values: new ArrayVector([1, 2, 3, 0]),
            config: {
              displayNameFromDS: 'debug',
            },
          },
        ],
      },
      {
        fields: [
          {
            name: 'Time',
            type: FieldType.time,
            values: new ArrayVector([1, 6]),
          },
          {
            name: 'Value',
            type: FieldType.number,
            values: new ArrayVector([2, 1]),
            config: {
              displayNameFromDS: 'error',
            },
          },
        ],
      },
    ]);
    expect(maximum).toBe(6);
  });
});

describe('getLogsVolumeDimensions', () => {
  function mockLogVolumeDataFrame(values: number[], absoluteRange: AbsoluteTimeRange) {
    return new MutableDataFrame({
      meta: {
        custom: {
          absoluteRange,
        },
      },
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: new ArrayVector([]),
        },
        {
          name: 'value',
          type: FieldType.number,
          values: new ArrayVector(values),
        },
      ],
    });
  }

  it('calculates the maximum value and range of all log volumes', () => {
    const maximumRange = getLogsVolumeMaximumRange([
      mockLogVolumeDataFrame([], { from: 5, to: 20 }),
      mockLogVolumeDataFrame([], { from: 10, to: 25 }),
      mockLogVolumeDataFrame([], { from: 7, to: 23 }),
    ]);

    expect(maximumRange).toEqual({ from: 5, to: 25 });
  });
});
