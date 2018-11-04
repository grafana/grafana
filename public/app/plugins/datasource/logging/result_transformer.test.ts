import { LogLevel } from 'app/core/logs_model';

import { getLogLevel } from './result_transformer';

describe('getLoglevel()', () => {
  it('returns no log level on empty line', () => {
    expect(getLogLevel('')).toBe(undefined);
  });

  it('returns no log level on when level is part of a word', () => {
    expect(getLogLevel('this is a warning')).toBe(undefined);
  });

  it('returns log level on line contains a log level', () => {
    expect(getLogLevel('warn: it is looking bad')).toBe(LogLevel.warn);
    expect(getLogLevel('2007-12-12 12:12:12 [WARN]: it is looking bad')).toBe(LogLevel.warn);
  });

  it('returns first log level found', () => {
    expect(getLogLevel('WARN this could be a debug message')).toBe(LogLevel.warn);
  });
});
