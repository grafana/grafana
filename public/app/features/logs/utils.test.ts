import { Labels, LogLevel, LogsModel, LogRowModel, LogsSortOrder, MutableDataFrame } from '@grafana/data';

import {
  getLogLevel,
  calculateLogsLabelStats,
  calculateStats,
  getLogLevelFromKey,
  sortLogsResult,
  checkLogsError,
  logRowsToReadableJson,
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
