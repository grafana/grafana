import { LogLevel } from '../types/logs';
import { getLogLevel, calculateLogsLabelStats, calculateFieldStats, getParser, LogsParsers } from './logs';

describe('getLoglevel()', () => {
  it('returns no log level on empty line', () => {
    expect(getLogLevel('')).toBe(LogLevel.unknown);
  });

  it('returns no log level on when level is part of a word', () => {
    expect(getLogLevel('this is information')).toBe(LogLevel.unknown);
  });

  it('returns same log level for long and short version', () => {
    expect(getLogLevel('[Warn]')).toBe(LogLevel.warning);
    expect(getLogLevel('[Warning]')).toBe(LogLevel.warning);
    expect(getLogLevel('[Warn]')).toBe('warning');
  });

  it('returns log level on line contains a log level', () => {
    expect(getLogLevel('warn: it is looking bad')).toBe(LogLevel.warn);
    expect(getLogLevel('2007-12-12 12:12:12 [WARN]: it is looking bad')).toBe(LogLevel.warn);
  });

  it('returns first log level found', () => {
    expect(getLogLevel('WARN this could be a debug message')).toBe(LogLevel.warn);
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
      expect(match![1]).toBe('bar');
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
