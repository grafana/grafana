import { MutableDataFrame } from '../dataframe/MutableDataFrame';
import { Labels } from '../types/data';
import { LogLevel, LogsModel, LogRowModel, LogsSortOrder } from '../types/logs';

import {
  getLogLevel,
  calculateLogsLabelStats,
  calculateFieldStats,
  getParser,
  LogsParsers,
  calculateStats,
  getLogLevelFromKey,
  sortLogsResult,
  checkLogsError,
} from './logs';

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

describe('LogsParsers', () => {
  describe('logfmt', () => {
    const parser = LogsParsers.logfmt;

    test('should detect format', () => {
      expect(parser.test('foo')).toBeFalsy();
      expect(parser.test('foo=bar')).toBeTruthy();
    });

    test('should return detected fields', () => {
      expect(
        parser.getFields(
          'foo=bar baz="42 + 1" msg="[resolver] received A record \\"127.0.0.1\\" for \\"localhost.\\" from udp:192.168.65.1" time(ms)=50 label{foo}=bar'
        )
      ).toEqual([
        'foo=bar',
        'baz="42 + 1"',
        'msg="[resolver] received A record \\"127.0.0.1\\" for \\"localhost.\\" from udp:192.168.65.1"',
        'time(ms)=50',
        'label{foo}=bar',
      ]);
    });

    test('should return label for field', () => {
      expect(parser.getLabelFromField('foo=bar')).toBe('foo');
      expect(parser.getLabelFromField('time(ms)=50')).toBe('time(ms)');
    });

    test('should return value for field', () => {
      expect(parser.getValueFromField('foo=bar')).toBe('bar');
      expect(parser.getValueFromField('time(ms)=50')).toBe('50');
      expect(
        parser.getValueFromField(
          'msg="[resolver] received A record \\"127.0.0.1\\" for \\"localhost.\\" from udp:192.168.65.1"'
        )
      ).toBe('"[resolver] received A record \\"127.0.0.1\\" for \\"localhost.\\" from udp:192.168.65.1"');
    });

    test('should build a valid value matcher', () => {
      const matcher = parser.buildMatcher('foo');
      const match = 'foo=bar'.match(matcher);
      expect(match).toBeDefined();
      expect(match![1]).toBe('bar');
    });

    test('should build a valid complex value matcher', () => {
      const matcher = parser.buildMatcher('time(ms)');
      const match = 'time(ms)=50'.match(matcher);
      expect(match).toBeDefined();
      expect(match![1]).toBe('50');
    });
  });

  describe('JSON', () => {
    const parser = LogsParsers.JSON;

    test('should detect format', () => {
      expect(parser.test('foo')).toBeFalsy();
      expect(parser.test('"foo"')).toBeFalsy();
      expect(parser.test('{"foo":"bar"}')).toBeTruthy();
    });

    test('should return detected fields', () => {
      expect(parser.getFields('{ "foo" : "bar", "baz" : 42 }')).toEqual(['"foo":"bar"', '"baz":42']);
    });

    test('should return detected fields for nested quotes', () => {
      expect(parser.getFields(`{"foo":"bar: '[value=\\"42\\"]'"}`)).toEqual([`"foo":"bar: '[value=\\"42\\"]'"`]);
    });

    test('should return label for field', () => {
      expect(parser.getLabelFromField('"foo" : "bar"')).toBe('foo');
      expect(parser.getLabelFromField('"docker.memory.fail.count":0')).toBe('docker.memory.fail.count');
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
      expect(match![1]).toBe('bar');
    });

    test('should build a valid value matcher for integers', () => {
      const matcher = parser.buildMatcher('foo');
      const match = '{"foo":42.1}'.match(matcher);
      expect(match).toBeDefined();
      expect(match![1]).toBe('42.1');
    });
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
    ] as LogRowModel[];

    expect(calculateFieldStats(rows, /baz=(.*)/)).toEqual([]);
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
    ] as LogRowModel[];

    expect(calculateFieldStats(rows, /foo=("[^"]*"|\S+)/)).toMatchObject([
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
